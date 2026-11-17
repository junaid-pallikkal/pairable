# RePair — Design System

**Direction:** editorial minimalism, human-centred, calm, trustworthy. Usability always beats decoration. Avoid: generic AI gradients, oversized pill buttons, fake metrics/dashboards, nested cards, particle confetti.

> **Update (D-12, D-13):** the live palette is monochrome warm: canvas #d9d4cc, panel #fbf8f3, surface #ffffff, text #111111, muted #7d776f, line #ebe6de; dark uses #0e0d0c / #1b1a18 / #262522. No red, yellow, blue or green. The tables below are the original plan. See src/index.css for the source of truth.

## 1. Tokens

### Color (light / dark)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FAFAF7` | `#101816` | page background |
| `--surface` | `#FFFFFF` | `#16211E` | cards, sheets |
| `--surface-2` | `#F3F4EF` | `#1C2A26` | subtle fills, inputs |
| `--border` | `#E4E6DF` | `#27362F` | hairlines |
| `--text` | `#172522` | `#EAF1EE` | primary text |
| `--text-muted` | `#5B6B66` | `#9DB0A9` | secondary text |
| `--primary` | `#176B5B` | `#6ABDA6` | primary actions |
| `--primary-fg` | `#FFFFFF` | `#0B1311` | text on primary |
| `--accent` | `#6ABDA6` | `#6ABDA6` | highlights, graph nodes |
| `--accent-soft` | `#E3F3EE` | `#1B332C` | tinted backgrounds |
| `--success` | `#1F8A4C` | `#4CC38A` | |
| `--warning` | `#B7791F` | `#E3A94B` | |
| `--danger` | `#C0392B` | `#F0786C` | |
| `--focus` | `#176B5B` | `#6ABDA6` | 2 px ring + 2 px offset |

Contrast: text/bg ≥ 4.5:1, UI components ≥ 3:1 (verify in both themes before use; adjust muted tokens if failing). Status never conveyed by color alone (icon + label).

### Typography — Plus Jakarta Sans (variable)
| Style | Size/Line | Weight | Tracking |
|---|---|---|---|
| Display | 56/60 (mobile 36/40) | 700 | -0.02em |
| H1 | 40/46 (28/34) | 700 | -0.015em |
| H2 | 28/34 (22/28) | 650 | -0.01em |
| H3 | 20/28 | 600 | 0 |
| Body | 16/26 | 400 | 0 |
| Body-sm | 14/22 | 400 | 0 |
| Caption | 12/18 | 500 | 0.01em |
Max line length 68ch for reading text. Numbers: tabular-nums in tables/stats.

### Spacing, radius, elevation
- 4 px base grid: 4 8 12 16 24 32 48 64 96.
- Radius: 6 (inputs/buttons) · 12 (cards) · 20 (sheets/hero composer). **No fully-round pill buttons** (pills only for small chips/badges).
- Elevation: `shadow-xs` hairline + border for cards; `shadow-md` only for floating (popovers, sheets). No heavy drop shadows.
- Layout: content max-width 1120 px (app), 720 px (reading/forms), 12-col grid desktop, 4-col mobile, 16 px gutters mobile / 24 px desktop.

### Breakpoints
`sm 640 · md 768 · lg 1024 · xl 1280` — design mobile-first at 360.

### Themes
Light / Dark / System. Implement by `data-theme` on `<html>` + CSS variables mapped into Tailwind v4 `@theme`. Persist choice; avoid flash via inline script in `index.html`.

## 2. Layout & Navigation

- **Public:** top header (logo · Explore · How It Works · Sign In · CTA). Footer with legal links.
- **App desktop:** left rail (Dashboard, Find Solvers, Explore Problems, My Activity, Connections, Messages, Notifications badge, Profile & Settings). Top bar: search, theme, user menu.
- **App mobile:** bottom tab bar (Home, Find, Messages, Activity, Me); Notifications in top bar; "New problem" FAB-less — primary button in Home.
- Contextual (not in primary nav): My Problems, My Contributions, My Resources, Solution Teams, Organizations, Workspace — reached from Dashboard tabs (Seeking · Helping) and Activity.
- Breadcrumb only inside deep case workspace.
- Create/edit actions → **Dialog (desktop) / Sheet (mobile)**. Destructive → confirm dialog naming the object.

## 3. Page Specs

### Home
1. **Header**
2. **Hero** — H: "Problems meet solutions." Sub: "Describe what you need. RePair helps you discover the right people, skills, and resources to move forward." Large composer (textarea, mic button, "Add details" disclosure), primary **Find My Solver**, secondary **I Can Help** (text-button style). Right/below: subtle static preview of the matching graph (not animated until interaction).
3. How RePair Works — 4 steps (Describe, Understand, Match, Resolve) with simple line icons.
4. Explore Possible Connections — interactive graph demo using *clearly labelled illustrative* sample, not live data.
5. What You Can Solve — category grid (from DB categories).
6. For People Who Need Help / For People Who Can Help — two-column editorial blocks.
7. Trust & Safety — 4 concrete commitments (verification levels, blocking/reporting, explained matches, no fake ratings).
8. Final CTA.
Rule: first screen is only about the user's problem.

### Dashboard
Tabs *Seeking* / *Helping*. Seeking: active cases w/ status + next step. Helping: new opportunities, active collaborations. Empty states offer one clear action. No vanity metrics.

### Case workspace
Header: title, status chip, progress bar (completed milestones/total — real). Tabs: Overview · Matches · Messages · Tasks · Milestones · Files · People.

## 4. Key Components (visual rules)

- **Button:** primary (filled `--primary`), secondary (outlined), ghost, destructive; height 40 (44 on touch); radius 6; icon+label.
- **Input:** 44 px height, label always visible, helper/error text below, error = icon + message.
- **Solver card:** avatar · name · headline · up to 3 skill chips (+N) · availability dot + text · help types · one-line "Why this match" (expand for breakdown) · trust row (verification icon + label, "N confirmed cases" if any) · actions: **Connect** (primary), Save (ghost). Single level of card; no nested cards.
- **Status chip:** icon + text; colors map: pending=warning, accepted/connected=success, declined=danger-muted, closed=neutral.
- **Empty state:** icon, one sentence, one action.
- **Skeletons** for loading; spinners only inside buttons.
- **Toasts** for non-blocking success/error; errors that block use inline alerts.

## 5. UX Principles → Concrete Rules
| Principle | Rule |
|---|---|
| Hick | ≤1 primary + ≤2 secondary actions per view; progressive disclosure for optional fields |
| Jakob | Left nav/bottom tabs, bell for notifications, chat UI like common messengers |
| Cognitive load | Wizards ≤3 steps; show 3 recs prominently, rest under "See more" |
| Fitts | Targets ≥44×44 px mobile; primary action in thumb zone |
| Recognition > recall | Icon+label everywhere; visible state chips; recent items |
| Goal-gradient | Case progress bar; onboarding step indicator |
| Gestalt | Proximity/whitespace group related fields; consistent alignment |
| Trust | Honest states ("Pending — waiting for Asha"), "not provided" instead of blanks, explain *why* data is requested |

## 6. Content & Tone
Plain, warm, specific. Indian English spellings. Avoid hype and jargon. Errors say what happened and what to do. Never claim success before server confirmation. Never display invented testimonials, counts or ratings.

## 7. Motion System (Motion library)

**Principles:** meaningful, state-driven, short. Durations 120/200/320 ms; easing `cubic-bezier(.2,.8,.2,1)`; springs only for matching scene.

| Pattern | Spec |
|---|---|
| Page/section reveal | fade + 8 px rise, once |
| Dialog/sheet | scale .98→1 / slide-up, 200 ms |
| List item enter | stagger ≤40 ms, max 8 items |
| Button press | scale .98, 80 ms |

### Signature MatchingScene (SVG/Canvas, `<MatchingScene state=… />`)
Input is a typed state machine, never timers pretending progress:

| State | Visual |
|---|---|
| `idle` | single problem node, soft pulse (slow) |
| `analyzing` | skill/resource satellite nodes fade in around it as they arrive from API |
| `discovering` | solver nodes placed on outer ring; count = real candidate count (cap display at 24, "+N") |
| `connecting` | lines draw from problem → persisted matches; stroke length ∝ nothing fake — equal for all |
| `ranked` | top matches scale up and gain accent ring; others dim |
| `results` | nodes morph into card positions (shared-layout transition) |
| `request_sending` | line from you → chosen node, dashed travelling dash |
| `request_pending` | dashed line steady, hourglass icon |
| `request_accepted` | line solidifies + gentle ring (only after server `accepted`) |
| `request_declined` | line fades, node dims; copy is respectful |
| `collab_started` | nodes join into a shared cluster |
| `resolved` | cluster settles, check mark, calm |
| `error` | static node with retry |

Reduced motion (`prefers-reduced-motion: reduce`): no travelling/pulsing/morph; states swap instantly with equivalent static icons and text; same information. Provide text live-region announcements ("12 possible solvers found").
Performance: ≤60 nodes, GPU-friendly transforms, pauses when tab hidden.

## 8. Accessibility
- Semantic landmarks; skip link; logical heading order.
- Focus ring always visible; focus trapped in dialogs, restored on close.
- All icons paired with accessible names; decorative = `aria-hidden`.
- Forms: associated labels, `aria-describedby` for errors, error summary on submit.
- Live regions for async results (matching complete, new message).
- Voice input is an enhancement, never required.
- Test with keyboard-only, NVDA/VoiceOver spot checks, axe in CI.

## 9. Iconography & Imagery
Lucide, 1.5 px stroke, 20/24 px. Avatars: uploaded or initials on tinted background. No stock-photo people implying real users. Illustrations: sparse, geometric, from node/line motif.

## 10. Do / Don't
Do: whitespace, honest states, one primary action. Don't: gradients as decoration, shadows stacked, pill CTAs, tooltips as sole explanation, placeholder-as-label, auto-playing motion without user context.
