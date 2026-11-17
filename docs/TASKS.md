# Tasks

Tick a box only when done and checked.

## Phases 1-7: done and checked

- [x] Whole journey checked in the real UI as seeker and solver, plus 83 backend checks
- [x] Style from the two reference images (monochrome plus one yellow accent)

## Phase 8: AI and voice

- [x] Assistant bubble bottom right: nudge bubble, panel, shortcuts, Escape closes, focus returns (checked in browser)
- [x] Honest behaviour when the AI is off (checked: says it is not switched on, input disabled)
- [x] Edge Function `ai` written (chat and problem suggestions), key only on the server
- [x] Voice button in the composer and in the assistant (hidden when the browser cannot do it)
- [ ] Deploy the `ai` function and add `AI_API_KEY` (you), then check real answers
- [ ] Check the voice button on a browser that supports it

## Phase 9: resources, safety, admin

- [x] Written: resources page, ask for a resource, resource matches on a problem, report, block, verification request, blocked list, suspended-account screen, admin area (overview, people, problems, reports, verification, categories, log)
- [x] `supabase/assistant.sql` and `supabase/phase9.sql` applied
- [x] `npm run test:e2e` passes 148 checks, including admin: overview, people, problems, reports, hide content, verification, suspend and restore, audit log, category add and remove
- [x] In the browser: onboarding for a new account, skill picker with add-new-skill, resources (add, validate, delete with confirm), report and block dialogs, verification card, every Admin tab, skill approval
- [ ] Not built: groups and organisations, disputes, file attachments, ID document upload, email notifications

## Phase 10: quality and launch

- [x] Integration test script `scripts/e2e.mjs` (journey plus phase 9 checks)
- [x] `supabase/audit.sql` security audit queries
- [x] Security headers and Content Security Policy (`vercel.json`, `public/_headers`)
- [x] Smaller first load (660 KB to 515 KB)
- [x] README with set-up steps and launch checklist
- [ ] Run `supabase/audit.sql` and check results (you)
- [ ] Vitest and Playwright (needs your OK to add packages)
- [ ] Real phone and screen reader pass
- [ ] Production project, email sender, domain, backups

## Rename, new look, login, bot, demos

- [x] Renamed to RePair; dark mode removed
- [x] Waving bot hero, creative home page, dashboard banner, card hover lift (checked in browser)
- [x] New sign-in and sign-up pages, forgot password and reset password (login, validation, eye toggle checked; reset email not sent yet)
- [x] `supabase/demo.sql` applied: 6 people, 6 problems, 6 resources confirmed in the database; demo person ranks first in a matching test
- [ ] Add `/reset-password` to Supabase Auth redirect URLs, then try Forgot password end to end (you)

## AI-first storytelling flow

- [x] Written: free-text matching SQL, Pip pages (Ask, Offer, Browse), swipe deck, waiting state and notifications, role-aware menu, new dashboards, admin attention view, animated landing
- [ ] Run `supabase/ai_matching.sql` then `supabase/demo_stories.sql` (you)
- [ ] Check the whole story in the browser and with the test script after that
- [ ] Rehearse with docs/DEMO.md

## Explore

- [x] Written: Problems and Solvers tabs, live search, sort, topic chips, Saved, Surprise me, side panel with chat box and flip-through, offer help from any account, chat with a solver
- [ ] Run `supabase/explore.sql`, then re-run `supabase/demo_stories.sql` (you)
- [ ] Check Explore end to end after that
