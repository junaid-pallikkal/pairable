# Decisions

Deviations from the planning docs, made to fit the 4-hour build in SCOPE.md. Product-level ones need owner sign-off.

| ID | Decision | Reason | Status |
|---|---|---|---|
| D-01 | One file `supabase/schema.sql`, run once in the SQL editor, instead of numbered migrations. | No CLI login or DB password available; TASKS.md asks for `schema.sql`. | accepted |
| D-02 | Matching runs as the Postgres function `run_matching` (weights fixed in the function), not an Edge Function with a `matching_config` table. | Nothing to deploy; same rules and explanations. Weights: skill 0.5, experience 0.2, availability 0.2, reliability 0.1; factors without real data are excluded and weights re-normalised. | accepted |
| D-03 | Conversations are keyed by connection (`messages.connection_id`); no separate `conversations` table. | Fewer tables; one chat per connection. | accepted |
| D-04 | Either side can start a request (`connections.initiated_by`). The other side responds. | Lets solvers offer help on public problems from Explore. | accepted |
| D-05 | Cases and connections change status only through functions (guard trigger + `app.rpc` flag). | Keeps state machines honest. | accepted |
| D-06 | Packages added: `react-router`, `lucide-react`, `motion`. No shadcn, TanStack Query, zod or react-hook-form. | Owner choice. Small hand-written components in `src/components`. | accepted |
| D-07 | Font loaded from Google Fonts in `index.html`. | Avoids another package. | accepted |
| D-08 | Skills are matched by the skills a person lists, not free text. The composer suggests skills by finding skill names in the description. | Real, explainable, no AI needed. | accepted |
| D-09 | Not built in phases 1-7: file attachments, groups, resources, reports and blocks, admin pages, AI interpretation, voice, email notifications. | Out of the requested phases or too large for the time box. | open |
| D-10 | Any signed-in user can read profiles marked "Let people find me". Matched solvers can read a case's full text when its visibility allows. | Simplest rule that works with RLS; tighten before launch. | open |
| D-11 | `public_cases` view runs with the owner's rights (it hides owner and private fields on purpose). | Visitors need to browse without signing in. | accepted |
| D-12 | Visual style changed to the owner's reference image: beige canvas, floating white sidebar, cream dotted work surface, black active states, soft white cards, black "+" circle for the main create action. Styling only. | Owner request. Replaces the green palette in DESIGN.md. | accepted |
| D-13 | No signal colours (red, yellow, blue, green). Status is shown by icon, label and black, outlined or grey chips. Errors show an alert icon and bold text. | Owner request. Keeps meaning independent of colour. | accepted |
| D-14 | Palette updated to the second reference: white surfaces, black actions, one yellow accent (#fbbc15). Still no red, blue or green. | Owner request. Replaces the beige palette of D-12. | accepted |
| D-15 | AI helper is one Edge Function `ai` (chat and problem suggestions) with the key held server-side, 30 calls per person per hour. The browser bubble works without it (shortcuts only) and says so honestly. | Key must never reach the browser; function cannot be deployed from here. Anthropic is the default provider. | accepted, needs deploy and key |
| D-16 | Voice input uses the browser's speech recognition (en-IN). Hidden when unsupported. No server speech. | Plan Phase 8. | accepted |
| D-17 | Phase 9 delivered: resources (offer, ask, availability, matching, requests), blocking, reporting, verification levels set by admin, suspended accounts locked out, admin area (overview, people, problems, reports, verification, categories, log) with every admin action in an audit log. | Plan Phase 9. | accepted |
| D-18 | Phase 9 NOT delivered: groups and organisations, disputes, file attachments, document upload for verification, email notifications. | Too large for this pass; verification is a manual admin decision with a note. | open |
| D-19 | Phase 10 delivered without new packages: integration test `scripts/e2e.mjs` (plain Node), `supabase/audit.sql`, security headers and CSP, smaller first load, README launch checklist. Vitest and Playwright not added. | SCOPE.md says ask before adding packages. | open: say if you want them |
| D-20 | Product renamed to RePair. | Owner request. | accepted |
| D-21 | No dark mode. Light only. Theme toggle, dark colours and the inline theme script removed; Content Security Policy no longer needs a script hash. | Owner request. | accepted |
| D-22 | Hero search box replaced by Pip, a waving 3D-style bot drawn in SVG and CSS (no 3D library). Its speech bubble opens the chat helper. The chat launcher and logo use the same bot face. | Owner request. No new package. | accepted |
| D-23 | Sign-in, sign-up, forgot-password and reset-password pages use a split card (art panel plus form) with a show/hide password eye. No Google or Facebook buttons until those providers are enabled in Supabase. | Owner request. A button that always fails would be dishonest. | open: say if you want social sign-in |
| D-24 | Demo data (6 people, 6 problems, 6 resources) lives in `supabase/demo.sql`, is labelled "Demo" in the app, and is removed by `supabase/demo_remove.sql`. Demo people cannot log in. | Owner request. Keeps fake data out of production. | accepted |
| D-25 | Main flow is now AI-first and form-free. A seeker writes a problem to Pip; a helper writes what they offer. No categories, no skills picker. | Owner direction. | accepted |
| D-26 | Matching works on the free text itself (word stems plus a small synonym list), inside the database. The AI function only adds related words and a summary. Without an AI key everything still works. | Demo must not depend on a key; no fake "AI" claims. | accepted |
| D-27 | Four sections: seeker (tell Pip, swipe matches or "I will notify you") and helper (tell Pip about me, browse problems). Waiting problems are matched automatically when a fitting helper saves a profile, and the seeker is notified. New problems notify fitting helpers. | Owner direction. | accepted |
| D-28 | The old category and skills composer and "Find solvers" page were removed from the menu. Old problems that have skills still open normally. | Replaced by Pip. | accepted |
| D-29 | Landing page is two equal paths ("I need someone", "I can help") with an animated illustration of a grandmother, a parent and a child. The search box and the skills band are gone. | Owner direction. | accepted |
| D-30 | Explore has two tabs, Problems and Solvers. Tapping an item opens a side panel with a chat box. Sending it creates a request; once accepted, the two chat freely. Anyone can offer help; a seeker-only account is switched to "both" when they do. | Owner request. | accepted |
| D-31 | Chatting with a solver without a problem creates a small private "chat" opener (kind = chat), hidden from lists, matching and admin counts. | Connections need a problem to hang on. | accepted |
| D-32 | Matching quality: a match needs at least 2 shared meaningful words, and 3 unless they cover a third of the problem. "grandchildren" no longer counts as "children". More generic words are ignored. | Found in testing: a phone-teaching problem matched five storytellers. | accepted |
| D-33 | Saved items on Explore are kept in this browser only (no database). | Simple, private, no new table. | open |
