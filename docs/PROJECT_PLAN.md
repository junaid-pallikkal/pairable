# RePair — Project Plan

Phases follow the master plan, with explicit deliverables, exit criteria and dependencies. Sequence is strict unless noted. Each phase ends with: tests passing (TEST_PLAN), docs updated, no known critical bugs.

Effort is in ideal engineering days for one full-stack developer working with Claude; treat as relative sizing.

| Phase | Name | Est. | Depends on |
|---|---|---|---|
| 0 | Project bootstrap | done | — |
| 1 | Architecture & documentation | 2 | 0 |
| 2 | Design foundation & public site | 6 | 1 |
| 3 | Auth & profiles | 6 | 2 |
| 4 | Problem management | 6 | 3 |
| 5 | Matching system | 8 | 4 |
| 6 | Connections & communication | 7 | 5 |
| 7 | Collaboration | 6 | 6 |
| 8 | AI & voice | 5 | 4 (can start after 4; integrates with 5) |
| 9 | Resources & trust, admin | 9 | 6 |
| 10 | Quality & launch | 7 | all |



---

## Phase 0 — Bootstrap ✅
Vite + React + TS, Tailwind v4, `@supabase/supabase-js` client at `src/lib/supabase.ts`, `.env.example`.

## Phase 1 — Architecture & Documentation
**Deliverables:** the 9 docs in `/docs`; seed data lists; decision log (REQUIREMENTS §9).
**Exit:** product owner signs off the ⚑ items.

## Phase 2 — Design Foundation & Public Site
**Deliverables**
- Tailwind theme tokens (colors, type, radii, shadows) for light + dark; `ThemeProvider` with system/light/dark.
- Plus Jakarta Sans via `@fontsource-variable`.
- shadcn/ui initialised; base primitives (Button, Input, Textarea, Dialog, Sheet, Tabs, Badge, Avatar, Tooltip, Toast, Skeleton, DropdownMenu, Select).
- Layouts: `PublicLayout`, `AppLayout` (sidebar desktop / bottom-nav mobile), `AdminLayout`.
- Router (React Router) with route guards stubbed.
- Motion primitives: fade/slide, reduced-motion hook, `MatchingScene` *prototype with mock states only in Storybook-like dev route*.
- Public pages: Home (all sections), Explore (static shell), How It Works, About, Privacy, Terms.
- Home composer interaction (stores draft in localStorage).

**Exit:** Lighthouse mobile ≥ 90 perf / 100 a11y on Home; light & dark verified; axe clean.

## Phase 3 — Authentication & Profiles
**Deliverables**
- DB migration 001 (profiles, skills, categories, user_skills, availability, settings) + RLS.
- Sign up / sign in / reset password / Google OAuth; email confirmation.
- Auth context + protected routes; role context (seeker/solver).
- Onboarding wizard (3 steps max): intent → profile basics → skills & availability.
- Profile view/edit (Sheet), privacy settings, avatar upload (public bucket `avatars`).
- Account deletion/export request flow (creates request row; admin fulfils in MVP).

**Exit:** new user can sign up, onboard, edit profile; RLS tests prove users cannot read/write others' private fields.

## Phase 4 — Problem Management
**Deliverables**
- Migration 002 (cases, case_skills, case_events).
- Composer (full-page + Home inline), draft autosave, edit, archive, delete (confirm dialog).
- Manual interpretation form (AI plugs in Phase 8).
- Case lifecycle: `draft → open → matching → in_progress → resolved | closed | cancelled`.
- My Problems list + case detail (seeker view); public Explore feed for `public` cases with full-text search + filters.
- Case timeline from `case_events`.

**Exit:** seeker can create, edit, publish, search & close cases; visibility rules enforced by RLS.

## Phase 5 — Matching System
**Deliverables**
- Migration 003 (matches, matching_config, resources minimal columns referenced).
- Edge Function `run-matching` (SQL eligibility → TS ranking → explanation builder).
- Admin-less config loaded from seed row; weights versioned.
- Find Solvers page + Case "Matches" tab; `SolverCard`, `MatchExplanation`.
- `MatchingScene` wired to real job states via Realtime on `matching_runs`.
- Opportunities feed for solvers (cases matching their skills).

**Exit:** deterministic ranking tests pass; explanation derived from breakdown only; hard-filter tests (blocked, suspended, owner) pass.

## Phase 6 — Connections & Communication
**Deliverables**
- Migration 004 (connections, connection_events, conversations, conversation_participants, messages, notifications, blocks).
- Request flow + state machine enforced in Postgres function `transition_connection()`.
- Pre-acceptance clarification thread.
- Realtime messaging, typing-less MVP, unread counts, read receipts (basic).
- Notifications bell + page; email via Edge Function `notify`.
- Request lifecycle animations (server-confirmed only).

**Exit:** two browser sessions complete request→accept→chat in Playwright; illegal transitions rejected by DB.

## Phase 7 — Collaboration
**Deliverables**
- Migration 005 (tasks, milestones, progress_updates, attachments, feedback, resolutions).
- Case workspace: Overview · Messages · Tasks · Milestones · Files · Participants.
- Private `attachments` bucket + signed URL Edge Function with participant check.
- Resolution proposal/confirmation, reopen window, feedback form, contribution records on profile.

**Exit:** full MVP journey passes E2E (seeker + solver).

## Phase 8 — AI & Voice
**Deliverables**
- Edge Function `ai-interpret` and `ai-explain-assist` with `AIProvider` interface, JSON-schema-validated output, timeout 15 s, retries 1, per-user rate limit, token/cost log (`ai_calls`).
- Prompt-injection hardening: user text always delimited and treated as data; output validated; no tool access.
- Clarification question loop UI; user-editable interpretation.
- Voice: `useSpeechRecognition` (Web Speech, `en-IN`), optional `speechSynthesis` read-aloud; feature-detected.
- Fallback: when AI unavailable, banner + manual form (already built Phase 4).

**Exit:** AI-down simulation still completes journey; schema-invalid AI output rejected.

## Phase 9 — Resources & Trust, Admin
**Deliverables**
- Migration 006 (resources, resource_requests, reports, moderation_actions, verifications, audit_log, disputes, groups, group_members).
- Resource CRUD, availability toggle, resource matching via same pipeline.
- Groups/organisations basics (create, invite, member roles).
- Reporting UI everywhere (user/case/message/resource); block/unblock UI.
- Verification submission + admin review.
- Admin workspace: Overview, Users, Problems, Reports & Moderation, Verification, Disputes, Resources, Categories, Analytics (real aggregates), System Settings.
- Spam controls: rate limits, duplicate detection.

**Exit:** admin can action a report end-to-end with audit trail; suspended user loses access immediately.

## Phase 10 — Quality & Launch
**Deliverables**
- Full Vitest + Playwright suites green in CI; axe on all key pages; manual screen-reader pass.
- Security review: RLS audit script, storage policy review, secret scan, CSP headers, dependency audit.
- Performance: bundle analysis, image optimisation, route splitting.
- Responsive QA at 360/768/1024/1440; Safari iOS check.
- Production: Supabase prod project, migrations applied, env vars, backups (PITR), domain, SMTP, Sentry, uptime check; deploy on Vercel/Netlify/Cloudflare Pages.
- Launch checklist & rollback plan.

---

## Cross-cutting rules (every phase)
1. Migrations are append-only, numbered, applied via Supabase CLI; never edit applied ones.
2. Every new table ships with RLS + policy tests in the same PR.
3. Every async UI has loading / empty / error / success states.
4. Docs updated in the same change as the code they describe.
5. Feature flags (`system_settings.flags`) gate incomplete features.

## Risks

| Risk | Mitigation |
|---|---|
| Cold-start: no solvers to match | Seed realistic *labelled* demo data in non-prod only; invite-first launch to curated solver pool. Never show fake users in prod. |
| AI cost/abuse | Rate limits, quotas, caching of interpretation per text hash. |
| Matching quality | Config-driven weights, admin review of low-confidence matches, collect "not relevant" feedback to tune. |
| Spam / abuse | Rate limits, verification tiers, moderation tooling in MVP. |
| RLS mistakes | Policy tests in CI; deny-by-default; admin via `is_admin()` function only. |
| Scope creep | Out-of-MVP list in REQUIREMENTS §4; changes need decision-log entry. |

## Open decisions (⚑ need owner input before the phase noted)
1. Default AI provider (before Phase 8).
2. Email provider (before Phase 6).
3. Public-case anonymisation default (before Phase 4).
4. Group/Org model depth in MVP (before Phase 5).
5. Hosting target (before Phase 10).
