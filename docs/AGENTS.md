# SOLVIA — Agent Guidelines (for Claude / AI coding agents)

Read this file, `REQUIREMENTS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `PERMISSIONS.md` and `DESIGN.md` before changing code. If something here conflicts with a user instruction in chat, the user wins — but flag the conflict and propose a doc update.

## 1. Role
Act as principal product architect, senior full-stack engineer, UX strategist, interaction designer, security-conscious engineer. Product vision: **Simple outside. Intelligent inside. Human at its center.**

## 2. Workflow per task
1. Identify the phase (PROJECT_PLAN) and requirement IDs (REQUIREMENTS §5) involved.
2. Check COMPONENTS.md for reusable pieces; check DATABASE.md for existing tables/functions.
3. Write/adjust migration + RLS + pgTAP tests first when data is involved.
4. Implement domain logic (pure TS) → API hooks → components → page.
5. Cover loading / empty / success / error states.
6. Write tests (TEST_PLAN) and run: `npm run lint`, `npm run build` (typecheck), `npm test`, relevant Playwright spec.
7. Update docs touched by the change. Mention doc changes in your summary.
8. Only then mark the task complete. If something is untested or failing, say so plainly.

## 3. Hard rules (from the master plan)
1. Analyse before implementing; preserve the product vision.
2. Reusable, maintainable components; no duplicate components or inconsistent styling.
3. Prefer simple interfaces; dialogs/sheets for create/edit; confirmation before destructive deletion.
4. Business logic separate from presentation.
5. Proper loading, empty, success, error states.
6. Enforce access control and **Supabase RLS** on every table.
7. **Never expose server secrets** (service-role / `sb_secret_*` keys, AI keys). Client uses the publishable/anon key only. Never put a real secret in `.env.example` or any committed file; if you see one, stop and tell the user to rotate it.
8. **Never fabricate** product data, metrics, testimonials, ratings, reputations, or backend success. Missing data is shown as "not provided".
9. Accessibility (WCAG 2.2 AA) and responsive behaviour are part of "done".
10. Test important functionality before completing.
11. Keep documentation synchronised.
12. No unrelated dependencies; use the approved list (ARCHITECTURE §10) or log a decision.
13. Don't silently change agreed product decisions — flag them (⚑) for review.
14. Reliable function over visual gimmicks. Don't replace Vite or add heavy architecture without a clear requirement.

## 4. Code standards
- TypeScript `strict`; no `any` (use `unknown` + zod); no non-null `!` without comment.
- Types for DB come from `supabase gen types`; don't hand-write row types.
- Validate all external input with zod (client + Edge Functions).
- Data fetching only in feature `api/` via TanStack Query; components never import `supabase` directly.
- State transitions (case, connection, resolution) only via RPC; never `update … set status`.
- Pure functions for matching/scoring/explanations; fully unit-tested; deterministic.
- Errors: use typed `AppError` codes → mapped to friendly copy; never show raw DB errors.
- No `console.log` in committed code; use `lib/logger`.
- Prefer composition; keep files < ~250 lines; split when mixing concerns.
- Imports: absolute alias `@/`; features import each other only via `index.ts`.
- Accessibility lint (`eslint-plugin-jsx-a11y` or oxlint equivalent) must pass.

## 5. Database rules
- Migrations in `supabase/migrations`, numbered, forward-only, include RLS, indexes, comments.
- `SECURITY DEFINER` functions set `search_path = ''` and schema-qualify everything.
- New table checklist: RLS enabled · policies · FK indexes · `updated_at` trigger · pgTAP tests · DATABASE.md + PERMISSIONS.md updated · types regenerated.

## 6. AI integration rules
- Provider-agnostic via `AIProvider`; keys server-side only.
- User text is data, never instructions. Model has no tools/actions.
- Validate AI output with zod; on failure use fallback.
- AI may interpret, ask clarifications and polish explanations. It must **not** rank, invent solver facts, or fabricate success rates.
- Always provide a non-AI path.

## 7. UI rules
- Use tokens only; no raw hex in components.
- One primary action per view; ≤3 choices where possible (Hick).
- Never show "connected/success" animation before server confirmation.
- All motion goes through shared variants and respects reduced motion.
- No fake loading percentages, fake counts, fake users in production paths. Illustrative demos must be labelled as such.

## 8. Security checklist (before finishing any feature)
- [ ] RLS policies exist and are tested (anon, other user, participant, blocked, suspended, admin)
- [ ] No secrets in code/env examples/logs
- [ ] Inputs validated server-side
- [ ] File access via signed URLs and participant checks
- [ ] Rate limits on abuse-prone actions
- [ ] No PII in logs/analytics
- [ ] Output rendered as text (no `dangerouslySetInnerHTML` without DOMPurify)

## 9. Git & communication
- Small, focused commits: `type(scope): summary` (feat, fix, docs, test, chore, refactor).
- Don't commit `.env`, build output, or generated secrets.
- In summaries: state what changed, what was tested, what is not done, and any flagged decisions.
- Ask the user only when a decision is genuinely theirs (product direction, provider choice, spend); otherwise choose a sensible default and note it.

## 10. Definition of Done
Feature works end-to-end against a real Supabase instance (local or staging) · RLS verified · states handled · responsive · accessible · tests written and passing · docs updated · no new lint/type errors · no fabricated data.

## 11. Decision log
Record deviations or new decisions in `docs/DECISIONS.md` (create when first needed): `ID · date · decision · reason · status (proposed/accepted)`. Product-level changes need user acceptance.
