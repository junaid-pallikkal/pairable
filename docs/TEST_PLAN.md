# SOLVIA — Test Plan

Principle: test the risky things first — permissions, state machines, matching correctness, and the end-to-end journey. Nothing is "complete" until its tests pass.

## 1. Tooling
| Layer | Tool |
|---|---|
| Unit / component | Vitest + React Testing Library + MSW |
| DB / RLS | pgTAP via `supabase test db` |
| Edge Functions | Deno test (with mocked AI provider) |
| E2E | Playwright (Chromium, WebKit, Firefox smoke; mobile viewports) |
| Accessibility | `@axe-core/playwright` + manual keyboard & screen-reader checks |
| Performance | Lighthouse CI |
| Security | RLS audit script, `npm audit`, secret scan (gitleaks), CSP check |

CI order: lint → typecheck → unit → pgTAP → build → Playwright (against staging/local Supabase) → Lighthouse. Merge blocked on failure.

## 2. Test Data
- Deterministic fixtures in `supabase/seed.dev.sql` (labelled DEMO): 2 seekers, 4 solvers (varied skills/availability/budget), 1 blocked pair, 1 suspended user, 1 admin, categories & skills.
- Playwright creates users via Auth admin API in test env only; cleans up.
- AI provider mocked in tests (success, invalid JSON, timeout, rate-limited).

## 3. Unit Tests (Vitest)
| Area | Cases |
|---|---|
| Scoring | each factor 0/partial/full; excluded factors renormalise weights; weights sum; determinism; tie-breaking |
| Explanation builder | uses only breakdown facts; "not provided" wording; no claims for excluded factors |
| Eligibility helpers (client mirrors) | owner, blocked, suspended, unavailable |
| State machines | every legal and illegal transition for connection, case, resolution |
| Zod schemas | boundaries (lengths, ranges, enums) |
| Mappers/formatters | INR budget ranges, relative time, skill overflow |
| Hooks | `useReducedMotion`, `useSpeechRecognition` (unsupported/denied/result) |
| Components | SolverCard, StatusChip, ConnectionActions (per state & viewer), InterpretationEditor, MatchExplanation, ConfirmDialog, FileUploader validation |

## 4. Database / RLS (pgTAP) — mandatory
For **every table**: anon denied; user A cannot select/insert/update/delete user B's rows; participant vs non-participant; blocked pair; suspended user denied; admin allowed where specified.
Specific:
- Cannot UPDATE `profiles.is_admin`, `status`, `verification` as member.
- Cannot UPDATE `cases.status` / `connections.status` directly.
- `transition_connection` rejects every illegal edge; creates conversation on accept; writes events.
- Unique open connection per (case, target).
- Message insert denied before acceptance (except clarification limits: 4th message rejected).
- `submit_feedback`: only on resolved case, participants only, once per pair.
- Storage: non-participant cannot read/upload attachments; verification docs readable only by owner/admin.
- `public_cases_view` exposes no owner/raw_text.
- `match_candidates` excludes owner, blocked, suspended, unavailable, declined-for-case.
- `audit_log` has no UPDATE/DELETE possible.

## 5. Edge Function Tests
| Function | Cases |
|---|---|
| ai-interpret | valid → schema-valid output; invalid JSON → error code `AI_INVALID`; timeout → `AI_UNAVAILABLE`; prompt-injection text doesn't alter schema/behaviour; rate limit; unauthenticated 401; cache hit |
| run-matching | non-owner 403; produces stable ranking; persists breakdown; failed run state recorded |
| signed-file-url | non-participant 403; participant gets 60 s URL |
| admin-ops | non-admin 403; writes audit log |
| notify | email only for configured kinds; idempotent |

## 6. E2E Scenarios (Playwright)
IDs map to REQUIREMENTS.

| ID | Scenario |
|---|---|
| E2E-01 | **MVP journey** (two browser contexts): seeker types problem → signs up → reviews/edits interpretation → confirms → matching scene → results with explanations → sends request → solver accepts → chat both ways → tasks & milestones → seeker proposes & confirms resolution → both submit feedback |
| E2E-02 | Solver declines → seeker sees declined state; no "connected" animation shown |
| E2E-03 | Solver requests clarification → seeker replies → pending again |
| E2E-04 | Request cancel and expiry (time-travel via function call) |
| E2E-05 | AI disabled → manual interpretation form completes journey; banner visible |
| E2E-06 | Voice button hidden when unsupported; works with mocked recogniser |
| E2E-07 | Block user → disappears from matches, cannot message |
| E2E-08 | Report user → appears in admin queue → admin suspends → user logged out/blocked → audit entry exists |
| E2E-09 | Resource offer listed → resource request matched → request flow |
| E2E-10 | Attachment upload/download; non-participant link fails after expiry |
| E2E-11 | Public Explore shows only `public_anonymised` cases; no identity leaks |
| E2E-12 | Auth: signup, email confirm (inbucket), login, logout, reset password, protected-route redirect |
| E2E-13 | Onboarding for seeker / solver / both |
| E2E-14 | Account data export/delete request |
| E2E-15 | Dual role: same account seeks and helps |
| E2E-16 | Duplicate/spam: rate limit triggers friendly error |
| E2E-17 | Realtime: message and notification appear without refresh |
| E2E-18 | Theme persistence light/dark/system without flash |

## 7. Matching-Specific Tests
- Golden dataset: fixed solvers & cases → expected ranked order & explanation text (snapshot reviewed by humans).
- Property tests: adding irrelevant skills never raises score; removing eligibility removes candidate; missing data never increases score.
- Fairness: new solver without history not ranked below equal solver due to absent reliability (factor excluded).
- No popularity inputs (verify by inspecting breakdown keys).

## 8. Animation / Motion Tests
- Scene state machine unit tests (valid state sequences from real events only).
- Visual smoke: each state renders; snapshot at key frames.
- With `prefers-reduced-motion` emulated: no animated transforms (check `animation`/`transition` computed styles), identical text/state output, live-region announcement present.
- "Accepted" visuals never rendered unless server status = accepted (test with pending data).

## 9. Accessibility
- axe: zero serious/critical on Home, Auth, Composer, Results, Messages, Workspace, Settings, Admin queue, in light & dark.
- Keyboard-only run of E2E-01 core steps (Tab order, focus trap, Esc closes dialogs, focus restoration).
- Screen-reader spot check (NVDA + VoiceOver) of Home, composer, results, chat.
- Contrast check of all token pairs in both themes (script).
- Zoom 200% and text-spacing override: no loss of content.
- Touch targets ≥ 44 px on mobile viewport audit.

## 10. Responsive & Cross-Browser
Viewports: 360×740, 390×844, 768×1024, 1024×768, 1440×900. Verify no horizontal scroll, nav switches (rail ↔ bottom tabs), dialogs ↔ sheets, composer usable with virtual keyboard. Browsers: Chrome, Edge, Safari (macOS & iOS), Firefox.

## 11. Performance
Lighthouse CI budgets (mobile, Home): Perf ≥ 90, LCP < 2.5 s, CLS < 0.1, TBT < 200 ms; JS initial < 200 KB gz; route chunks lazy. Match run p95 < 5 s (excl. AI) on seeded 1k solvers / 10k users dataset. Query plans reviewed for FTS and match retrieval.

## 12. Security Tests
- RLS audit: script lists tables lacking RLS or policies → CI fail.
- Secret scan on repo & built bundle (no `service_role`/`sb_secret_`).
- IDOR: iterate IDs of cases/conversations/files as other user → 404/denied.
- XSS payloads in names, bios, messages, titles, filenames render as text.
- File upload: disallowed MIME/size rejected; double-extension; path traversal.
- Prompt injection corpus against ai-interpret.
- Rate limit & brute-force on auth.
- CSP & security headers present on deployment.
- `npm audit` no high/critical.

## 13. Manual Exploratory Checklist (pre-launch)
Full journey on real mobile devices; low-bandwidth (Slow 4G) run; offline/reconnect during chat; AI outage; Supabase Realtime drop/resume; clock skew on expiry; long text and RTL-free but Indic-script input (Devanagari, Tamil) displays correctly even though UI is English.

## 14. Exit Criteria
- 100% of Must-have scenarios (E2E-01…E2E-12, E2E-17) pass on all target browsers.
- All pgTAP tests pass; no table without RLS.
- 0 open critical/high defects; medium defects triaged.
- Accessibility & performance budgets met.
- Launch checklist (PROJECT_PLAN Phase 10) signed off.

## 15. Requirement Traceability (summary)
| Requirement | Tests |
|---|---|
| F1 Problem submission | E2E-01, 05, 06; unit (zod, InterpretationEditor); Edge ai-interpret |
| F2 Matching | unit scoring/explanations; golden; pgTAP match_candidates; E2E-01, 07 |
| F3 Animation | motion tests §8; E2E-02 |
| F4 Solver cards | component tests; axe |
| F5 Connections | state-machine unit + pgTAP; E2E-02/03/04 |
| F6 Messaging & collaboration | pgTAP messages/feedback; E2E-01, 10, 17 |
| F7 Resources | E2E-09; pgTAP resources |
| F8 Trust & safety | E2E-07, 08, 16; pgTAP reports/blocks; security tests |
