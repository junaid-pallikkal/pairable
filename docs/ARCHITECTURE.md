# SOLVIA — Architecture

Principle: simplest thing that works. SPA + Supabase. No custom server beyond Edge Functions.

## 1. System Overview

```
┌────────────────────────── Browser (Vite SPA) ──────────────────────────┐
│ React 19 · TS · Tailwind v4 · shadcn/ui · Motion · React Router        │
│ TanStack Query (server state) · Zustand (small UI state) · zod         │
└───────────────┬───────────────────────────────┬────────────────────────┘
                │ supabase-js (anon key + JWT)  │ functions.invoke
                ▼                               ▼
┌──────────── Supabase ────────────┐   ┌──── Edge Functions (Deno) ────┐
│ Auth · Postgres (RLS) · Storage  │◄──│ run-matching · ai-interpret   │
│ Realtime (postgres_changes)      │   │ ai-explain · notify           │
│ pg_cron · pg_trgm · FTS          │   │ signed-file-url · admin-ops   │
└──────────────────────────────────┘   └───────────┬───────────────────┘
                                                   ▼
                                    AI provider (via AIProvider adapter)
                                    Email provider (Resend/SMTP)
```

Rules:
- Browser only ever holds the **anon/publishable** key. The service-role / `sb_secret_*` key exists only in Edge Function env and CI secrets.
- All writes that need cross-row invariants go through **Postgres functions (RPC)** or Edge Functions; simple owner-scoped CRUD may use table APIs under RLS.
- Business logic lives in `src/features/*/api` + `domain` (pure TS), never inside components.

## 2. Frontend Structure

```
src/
  app/                 router, providers, layouts, route guards
  components/ui/       shadcn primitives (generated; do not hand-fork)
  components/          shared composed components (see COMPONENTS.md)
  features/
    auth/  profile/  cases/  matching/  connections/
    messaging/  collaboration/  resources/  trust/  admin/  notifications/
      ├─ api/          supabase calls + query hooks (TanStack Query)
      ├─ domain/       pure types, state machines, mappers, zod schemas
      ├─ components/   feature-specific UI
      └─ pages/        route components (thin)
  lib/                 supabase client, utils, env, analytics, errors
  hooks/               generic hooks (useReducedMotion, useSpeech, useDebounce)
  styles/              tokens.css, globals
  types/               generated `database.types.ts` (supabase gen types)
supabase/
  migrations/  functions/  seed.sql  config.toml  tests/
docs/
```

Conventions: feature folders import `components/ui` and `lib`, never each other's internals (use each feature's `index.ts`). Route components are lazy-loaded.

### State
- **Server state:** TanStack Query; keys namespaced `['cases', id]`; Realtime events call `queryClient.setQueryData/invalidate`.
- **UI state:** component state; Zustand only for cross-page UI (theme, composer draft).
- **Forms:** react-hook-form + zod resolvers; the same zod schema is mirrored in Edge Functions for server validation.

### Routing (React Router)
Public: `/`, `/explore`, `/how-it-works`, `/about`, `/privacy`, `/terms`, `/auth/*`
App (auth): `/app` (dashboard), `/app/find`, `/app/explore`, `/app/activity`, `/app/connections`, `/app/messages/:id?`, `/app/notifications`, `/app/settings`, `/app/cases/new`, `/app/cases/:id/(overview|matches|workspace)`, `/app/resources`, `/app/groups/:id`, `/app/u/:id`
Admin: `/admin/(overview|users|problems|reports|verification|disputes|resources|categories|analytics|settings)`

Guards: `RequireAuth`, `RequireOnboarded`, `RequireAdmin` (UI convenience only — real enforcement is RLS).

## 3. Backend Design

### Postgres
See DATABASE.md. Key patterns:
- `profiles.id = auth.users.id`; trigger creates profile on signup.
- Helper SQL functions (`SECURITY DEFINER`, `search_path=''`): `is_admin()`, `is_case_participant(case_id)`, `is_blocked_between(a,b)`.
- State machines enforced by RPC (`transition_connection`, `transition_case`, `propose_resolution`) — clients cannot update `status` columns directly (column-level privileges / no UPDATE policy on status).
- `updated_at` trigger on all mutable tables.
- Full-text: generated `tsvector` columns + GIN indexes on cases, profiles, resources; `pg_trgm` for fuzzy skill names.

### Realtime
Subscribe (RLS-filtered) to: `messages` (by conversation), `notifications` (by user), `connections` (by case/user), `matching_runs` (by case), `tasks`/`milestones` (by case).

### Storage buckets
| Bucket | Access | Path | Notes |
|---|---|---|---|
| `avatars` | public read, owner write | `{user_id}/avatar.webp` | ≤2 MB images |
| `attachments` | **private** | `{case_id}/{uuid}-{name}` | policy: participant of case; downloads via signed URL (60 s) |
| `verification-docs` | **private**, admin + owner only | `{user_id}/{uuid}` | auto-delete after review + 30 days |

### Edge Functions
| Function | Auth | Purpose |
|---|---|---|
| `ai-interpret` | user JWT | Case text → structured interpretation + clarifying questions |
| `ai-explain` | user JWT | (Optional) rewrite deterministic explanation into friendlier prose; fallback = template text |
| `run-matching` | user JWT (case owner) | Create `matching_run`, execute eligibility + ranking, persist `matches` |
| `notify` | DB webhook / service | Fan-out email for notifications |
| `signed-file-url` | user JWT | Verify participation → signed URL |
| `admin-ops` | admin JWT | Privileged actions that need service role (suspend → revoke sessions) |
| `expire-requests` | pg_cron | Expire stale connection requests |

Every function: validates input with zod, rate-limits by user id (table `rate_limits`), returns typed error codes, logs without PII.

## 4. AI Integration

```ts
interface AIProvider {
  interpret(input: InterpretInput): Promise<InterpretOutput>   // JSON-schema constrained
  explain?(input: ExplainInput): Promise<string>
}
```
- Adapter chosen by env `AI_PROVIDER`; keys in Edge env only.
- Output validated with zod; invalid → treated as failure (fallback path).
- User text is passed as quoted data in a fixed system prompt; model has **no tools** and cannot trigger actions.
- Timeout 15 s, 1 retry, circuit-breaker flag `ai_enabled` in `system_settings`.
- Caching: `ai_calls.input_hash` → reuse identical interpretation within 24 h.
- Logging: tokens, latency, status; **not** raw text beyond the case itself.
- AI never ranks and never invents facts about solvers; explanations are built from `score_breakdown`.

## 5. Voice
Browser Web Speech API (`SpeechRecognition`, lang `en-IN`) → text inserted into composer for user review. `speechSynthesis` optional read-aloud for interpretations. Feature-detected; mic button hidden if unsupported; permission denial shows inline help.

## 6. Matching Engine

### 6.1 Unified model
Everything matchable is a **party** (user | group) holding **offers** (skills, resources) and **needs** (case required skills/resources). The six models are label combinations of (need-side kind × offer-side kind):

| Model | Need side | Offer side |
|---|---|---|
| Group × Group | group case | group offer |
| Skill × Skill | skill need | skill offer |
| Resource × Resource | resource need | resource offer |
| Group × Skill | group | skill |
| Group × Resource | group | resource |
| Skill × Resource | skill need | resource offer (e.g., "tool + operator") |

`matches.model` stores the label; one pipeline runs for all.

### 6.2 Pipeline
1. **Create run** (`matching_runs`: status `running`, config version).
2. **Candidate retrieval (SQL)**: FTS/trigram on required skills + category; resources by category/location.
3. **Hard eligibility (SQL, mandatory, pre-rank)**: active, not suspended, no block either direction, not owner, availability ≠ unavailable, location/remote compat, visibility, not previously declined for this case.
4. **Scoring (TS pure function, unit-tested)**:
   `score = Σ wᵢ · fᵢ`, each fᵢ ∈ [0,1], weights from `matching_config` (default sum = 1):

| Factor | Default w | How computed (only real data) |
|---|---|---|
| skill_relevance | 0.35 | Jaccard-weighted overlap of required vs offered skills, with proficiency |
| experience | 0.20 | Years + evidence items (links, past confirmed cases); capped |
| availability | 0.15 | Overlap of availability windows / status |
| budget | 0.10 | Range overlap; `null` if unspecified → factor excluded & weights renormalised |
| communication | 0.10 | Language/channel/timezone preference overlap |
| reliability | 0.10 | Confirmed-completion ratio if ≥3 accepted cases; else excluded & renormalised |

   Factors with insufficient data are **excluded and shown as "not provided"** — never assumed.
5. **Explain**: template per factor generates sentences from `score_breakdown` (e.g., "Offers Python (advanced) and 4 years evidenced experience. Available weekday evenings. Budget not specified."). Optional AI polish may rephrase but cannot add facts (output diffed against allowed facts list).
6. **Persist** top N (default 20) to `matches`; run → `complete`; Realtime notifies client.

### 6.3 Animation state mapping
| Real state | Scene |
|---|---|
| case `open`, user clicks Find | problem node appears |
| `matching_runs.status = running` | skill/resource nodes drift in (indeterminate) |
| candidates count returned | solver nodes placed (count = real) |
| `complete` | lines drawn only to persisted matches; top matches emphasised |
| cards loaded | transition to card list |
| `failed` | calm error state with retry |

## 7. Connection State Machine

```
draft ─send→ pending ─accept→ accepted ─close→ closed
                │  ├─decline→ declined
                │  ├─cancel→  cancelled
                │  ├─expire→  expired
                │  └─ask→ clarification_requested ─respond→ pending
```
Enforced in `transition_connection(connection_id, action, payload)`; inserts a `connection_events` row; on `accepted` creates conversation + participant rows and adds user to case participants.

## 8. Security Architecture
- Deny-by-default RLS; policy matrix in PERMISSIONS.md; automated policy tests (pgTAP).
- JWT claims: role resolved from `profiles.is_admin` via `is_admin()`; never trust client role.
- Inputs: zod on client **and** server; SQL via parameterised queries/RPC only.
- XSS: render user text as text; sanitise any rich text with DOMPurify (MVP: plain text + linkify only).
- CSP, `X-Frame-Options`, `Referrer-Policy`, HSTS via hosting headers.
- Rate limiting: `rate_limits` table + RPC `check_rate_limit(key, limit, window)`.
- Secrets: `.env` is git-ignored; `.env.example` contains placeholders only; rotate any leaked key immediately.
- Audit: `audit_log` for admin and moderation actions (append-only, no UPDATE/DELETE policy).
- Privacy: location stored at city granularity; exact address never required; data export/delete workflow.

## 9. Environments & Tooling
| Env | Supabase | Purpose |
|---|---|---|
| local | `supabase start` (Docker) | dev + pgTAP |
| staging | project `solvia-staging` | previews, E2E |
| prod | project `solvia-prod` | live |

- Supabase CLI for migrations, `supabase gen types typescript` → `src/types/database.types.ts`.
- CI (GitHub Actions): lint (oxlint), typecheck, Vitest, pgTAP, build, Playwright on preview.
- Env vars (client): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. (Server): `SUPABASE_SERVICE_ROLE_KEY`, `AI_PROVIDER`, `AI_API_KEY`, `RESEND_API_KEY`.

## 10. Key Dependencies (approved list; anything else needs a decision-log entry)
`react-router`, `@tanstack/react-query`, `zustand`, `react-hook-form`, `zod`, `motion`, `lucide-react`, `shadcn/ui` (+ Radix, `class-variance-authority`, `tailwind-merge`), `date-fns`, `@fontsource-variable/plus-jakarta-sans`, `dompurify`; dev: `vitest`, `@testing-library/react`, `playwright`, `@axe-core/playwright`, `msw`.

## 11. Deployment
Static build to Vercel/Netlify/Cloudflare Pages (SPA fallback to `index.html`). Migrations applied by CI on merge to `main` for staging, manual approval for prod. Backups: Supabase PITR. Rollback: redeploy previous build; migrations forward-fix only.
