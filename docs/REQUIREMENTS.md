# RePair — Requirements

**Tagline:** Problems Meet Solutions · **Market:** India · **Language:** English only
**Philosophy:** Simple outside. Intelligent inside. Human at its center.
**Journey:** Describe → Understand → Discover → Match → Connect → Collaborate → Resolve

Source: `RePair_MASTER_WEBSITE_PLAN.md`. This document resolves ambiguities in that plan (see §9) and fixes MVP boundaries.

---

## 1. Glossary

| Term | Meaning |
|---|---|
| **Solution Case** (case) | A structured problem record that tracks a problem from draft to confirmed resolution. Central entity. |
| **Seeker** | A user acting on a case they own. |
| **Solver** | A user offering skills/resources. One account can be both (a *role context*, not an account type). |
| **Group** | A named set of users (team, community, org unit) with a shared profile. Org = a verified group. |
| **Skill** | A capability a person or group offers or a case needs. |
| **Resource** | A physical or digital thing offered or requested (equipment, space, books, tools). |
| **Match** | A ranked, explained recommendation of a solver/group/resource for a case. |
| **Connection request** | A seeker→solver (or solver→case) proposal to collaborate on a case. |
| **Collaboration workspace** | Per-case area: messages, tasks, milestones, files, progress. |

## 2. Users & Roles

| Role | Description |
|---|---|
| Visitor | Unauthenticated; sees public pages only. |
| Member | Authenticated user. Can act as seeker and/or solver. |
| Group admin | Member who manages a group/organization profile and its members. |
| Platform admin | Operates the platform: moderation, verification, disputes, categories, analytics, settings. |

## 3. MVP Scope (IN)

1. **Auth & onboarding** — email+password and Google sign-in; onboarding asks "I need help / I can help / both".
2. **Profile** — bio, skills (with evidence), availability, help types, location (city/state), privacy settings.
3. **Problem composer** — text input (voice in Phase 8); optional urgency, location, budget range, help type.
4. **AI interpretation** — structured summary (title, category, required skills, constraints) + ≤3 clarifying questions; user can edit everything. Rule-based fallback when AI is down.
5. **Matching engine** — rule-based, configurable weights; hard eligibility filters first; plain-English explanation per match; all six connection models supported structurally (see ARCHITECTURE §6).
6. **Matching animation** — driven by real states (see DESIGN §7); reduced-motion fallback.
7. **Solver cards** — name, expertise, skills + evidence, availability, help type, explanation, trust indicators, connect action.
8. **Connections** — request, pending, accept, decline, request clarification, cancel, connected, closed.
9. **Messaging** — private real-time 1:1 and case group threads, only after acceptance; attachments via private storage.
10. **Collaboration** — tasks, milestones, progress updates, multiple solvers, resolution confirmation, feedback.
11. **Resource network (basic)** — list offered/requested resources, availability toggle, simple matching on category + location + keywords.
12. **Trust & safety** — report, block, admin moderation queue, optional verification (email/phone/ID-document review by admin), privacy controls.
13. **Admin** — overview, users, problems, reports, verification, disputes, resources, categories, basic analytics, settings.
14. **Notifications** — in-app (realtime); email for key events (request received/accepted, message while offline).
15. **Public site** — Home, Explore, How It Works, About, Privacy, Terms.

## 4. Explicitly OUT of MVP (Later)

Multi-hop matching, Opportunity Radar, smart substitution, AI solution-team formation, professional-network integrations, advanced resource pooling, skill barter, payments, organizational subscriptions, advanced reputation/impact intelligence, semantic (vector) search, native mobile apps, languages other than English.

## 5. Functional Requirements (by feature)

IDs are used by TEST_PLAN.md.

### F1 Problem submission
- **F1.1** Composer is distraction-free: one text area, collapsible "add details" (urgency, location, budget, help type).
- **F1.2** Drafts autosave. Unauthenticated visitors may type a problem; it is held locally and attached after sign-up.
- **F1.3** AI returns an *interpretation*: title, summary, category, required skills, constraints, missing info. Displayed as editable fields.
- **F1.4** AI asks only questions whose answers would change matching. Max 3 per round, max 2 rounds.
- **F1.5** User must confirm interpretation before the case is published/matchable.
- **F1.6** If AI fails, user fills the same fields manually; no dead end.

### F2 Matching
- **F2.1** Hard filters (applied before ranking): solver active & not suspended; not blocked either way; not the case owner; location/remote compatibility; availability not "unavailable"; case visibility rules; help-type compatibility.
- **F2.2** Ranking factors: skill relevance, evidenced experience, availability, budget compatibility, communication compatibility, reliability (derived from real outcomes only).
- **F2.3** Weights stored in `matching_config` (admin-editable, versioned).
- **F2.4** Every match stores a `score_breakdown` and a plain-English `explanation` generated from that breakdown (never invented).
- **F2.5** Missing data is shown as "not provided", never defaulted to a favourable value.
- **F2.6** No popularity boosting. New solvers are not penalised for having no history; reliability shows "No history yet".
- **F2.7** Results stable for a given case+config version; re-run on case edit or on demand.

### F3 Animation
- **F3.1** Each animation stage is triggered by a real event (case confirmed → matching job running → candidates returned → cards ready).
- **F3.2** No fake progress percentages; use indeterminate states if duration unknown.
- **F3.3** Request lifecycle animations: sending, pending, accepted, declined, collaboration started, resolved. "Connected" animation fires only on server-confirmed acceptance.
- **F3.4** `prefers-reduced-motion` → static equivalents conveying identical state.

### F4 Solver cards
- **F4.1** Compact; max 3 skill chips + "+N"; one-line explanation with "Why this match" expansion.
- **F4.2** Trust indicators only from real data (verification status, completed cases, confirmed feedback count).

### F5 Connections
- **F5.1** State machine: `draft → pending → (accepted | declined | clarification_requested | cancelled | expired)`; `accepted → closed`.
- **F5.2** Clarification returns to `pending` after seeker responds.
- **F5.3** Requests expire after 14 days without response (configurable).
- **F5.4** Rate limit: 10 outgoing pending requests per user; 5 requests per case per day.
- **F5.5** Declined solver is not re-requested for the same case unless solver re-opens.

### F6 Messaging & collaboration
- **F6.1** Conversations exist only between accepted participants of a case.
- **F6.2** Attachments: ≤10 MB, allow-listed types (pdf, png, jpg, docx, xlsx, txt, zip≤10MB); virus-scan hook placeholder; served via short-lived signed URLs.
- **F6.3** Tasks: title, assignee, due date, status (todo/doing/done).
- **F6.4** Milestones: ordered, with status; progress % = completed milestones / total (real).
- **F6.5** Multiple solvers per case; each has own accepted connection.
- **F6.6** Resolution: seeker proposes → seeker confirms (or solvers confirm contributions) → case `resolved` → feedback prompt. Seeker can reopen within 7 days.

### F7 Resources
- **F7.1** Resource: title, type, category, description, location, condition/availability, offer|request, owner (user or group).
- **F7.2** Matching: category + location + full-text. Connection uses the same request flow, linked to resource.
- **F7.3** Owner toggles availability; unavailable resources excluded from matches.

### F8 Trust & safety
- **F8.1** Report user/case/message/resource with reason + free text.
- **F8.2** Block: mutual invisibility, no requests, existing conversations hidden.
- **F8.3** Moderation actions: dismiss, warn, hide content, suspend, ban — all audit-logged.
- **F8.4** Verification levels: none · email · phone · document (admin-reviewed). Displayed truthfully.
- **F8.5** Feedback only from participants of a resolved case; one per participant pair per case.
- **F8.6** Spam: rate limits, duplicate-content detection on cases, new-account throttles.

## 6. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Security | RLS on every table; no service key in client; Edge Functions hold AI/provider keys; input validation (zod) at boundaries; signed URLs for files. |
| Privacy | DPDP Act 2023 aligned: consent at signup, data export & deletion on request, minimal PII, location at city level by default. |
| Performance | LCP < 2.5 s on 4G mobile; route-level code splitting; match results < 5 s p95 (excluding AI step). |
| Accessibility | WCAG 2.2 AA; keyboard operable; visible focus; ≥44 px targets; screen-reader labels; reduced motion. |
| Responsive | Mobile-first; breakpoints 360 / 768 / 1024 / 1440. |
| Reliability | Graceful AI fallback; optimistic UI never shows false success (rollback on failure). |
| Observability | Error tracking (Sentry-compatible), Edge Function logs, audit log for admin actions. |
| Browser support | Last 2 versions of Chrome, Edge, Safari, Firefox; iOS Safari 16+. |
| i18n | English only; strings centralised so localisation is possible later. |

## 7. User Flows (summary)

**Seeker:** Land → type problem → (sign up if needed) → AI interpretation → edit/confirm → matching animation → results → compare → send request → pending → accepted → workspace → milestones/tasks → propose resolution → confirm → feedback.

**Solver:** Sign up → "I can help" → profile/skills/availability → opportunities feed → view case summary → accept / decline / ask clarification → workspace → contribute → feedback received.

**Admin:** Login → overview → moderation queue → review report → action (audit-logged) → notify parties.

## 8. MVP Acceptance Criteria

The full journey completes end to end with real data: describe problem → review interpretation → discover solvers → read explanations → send request → solver accepts → message → collaborate (tasks/milestones) → confirm resolution → feedback. Plus: a resource can be listed and matched; admin can action a report. A polished page with non-functional flows fails acceptance.

## 9. Contradictions, Gaps & Decisions

Items flagged for product-owner review are marked ⚑.

| # | Issue in plan | Decision |
|---|---|---|
| 1 | "Group" never defined; Group×Group matching unclear. | Group = `groups` table with members. Matching is entity-agnostic: a *party* is a user or group; skills/resources attach to either. Six models are combinations of (party | skill | resource) pairs, implemented via one `match_candidates` pipeline, not six engines. ⚑ |
| 2 | Six connection models are conceptual; UI only shows solver cards. | MVP UI surfaces: people/groups (cards) and resources (cards). Model label is internal metadata on each match. |
| 3 | AI "provider-agnostic" but no provider named. | Define `AIProvider` interface in an Edge Function; default adapter configurable by env (Anthropic/OpenAI/Gemini). ⚑ choose default. |
| 4 | Voice input/output "where supported". | Browser Web Speech API (en-IN) in Phase 8; hidden when unsupported. No server STT in MVP. |
| 5 | "Explore Problems" public yet problems may be sensitive. | Cases default **private**; seeker opts in to *public (anonymised)* visibility. Public cards hide name/exact location. ⚑ |
| 6 | Seeker/solver dual role vs. separate nav. | Single nav; "My Problems" / "My Contributions" contextual. Dashboard tabs: Seeking · Helping. |
| 7 | Reputation "genuine" but no formula. | Reliability = completed-and-confirmed cases ÷ accepted cases, shown only with ≥3 accepted; otherwise "No history yet". |
| 8 | Payments listed "later" but budget filter in MVP. | Budget is an *informational range* only; no payment processing in MVP. Platform is not responsible for off-platform payments (Terms). |
| 9 | Verification undefined. | Levels in F8.4; document review manual by admin. |
| 10 | Messaging allowed with "accepted solvers" but clarification requests need a channel. | Clarification uses a limited pre-acceptance thread (max 3 messages each side, text only) attached to the request. |
| 11 | Admin spec lists "Resource Management" and "Categories" but no taxonomy. | Seed categories (see DATABASE §seed); admin-editable. |
| 12 | Auth provider unspecified. | Supabase Auth: email/password + Google. Phone OTP deferred. |
| 13 | shadcn/ui + Tailwind v4 | Project already uses Tailwind v4; use shadcn/ui's v4-compatible setup. |
| 14 | Email notifications not mentioned. | Included for key events via Supabase + Resend (or SMTP). ⚑ choose provider. |
| 15 | Minors / age. | 18+ only (Terms). |
| 16 | Admin "System Settings" vague. | Settings = matching weights, rate limits, request expiry, feature flags, maintenance banner. |
