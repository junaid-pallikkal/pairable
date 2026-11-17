# SOLVIA — Permissions & Row Level Security

**Default: deny.** Every table has RLS enabled and no policy = no access. The client never uses the service-role key. Admin power comes from `is_admin()` (checks `profiles.is_admin` + active), evaluated in the database.

## 1. Actors

| Actor | Identity |
|---|---|
| `anon` | Not signed in |
| `member` | `auth.uid()` present, `profiles.status='active'` |
| `owner` | member who owns the row (`owner_id`/`user_id` = uid) |
| `participant` | member in `case_participants` for the case (or owner) |
| `group_admin` | `group_members.role in ('owner','admin')` |
| `admin` | `is_admin()` true |
| `service` | Edge Function using service role (server only) |

Suspended/banned users: all policies require `status='active'` via helper `is_active_user()`, so access is lost immediately.

## 2. Table Policy Matrix

C = insert · R = select · U = update · D = delete. "RPC" = changes only through a SECURITY DEFINER function; no direct policy.

| Table | anon | member | owner / participant | admin |
|---|---|---|---|---|
| profiles | R via `public_profile_view` (discoverable only) | R others via view; R/U own (excl. `is_admin`, `status`, `verification`) | R/U own | R/U all |
| categories, skills (approved) | R | R; C proposed skill (unapproved) | — | CRUD |
| user_skills | — | R others (if discoverable); CRUD own | own | R/U (verify) |
| availability_windows | — | R others (if discoverable); CRUD own | own | R |
| blocks | — | CRD own (as blocker) | — | R |
| cases | R `public_cases_view` only | C own; R own; R `public_anonymised` via view | owner: R/U (non-status cols) / D if draft; participant: R | R/U |
| case_skills | — | CRUD for own cases | participant R | R |
| case_events | — | — | participant R; insert via RPC/trigger | R |
| case_participants | — | R own rows | participant R | R |
| matching_config | — | — | — | R/U; `service` R |
| matching_runs / matches | — | R for own cases (owner) | owner R; matched solver R *their own match row only* | R |
| match_feedback | — | C/R own | — | R |
| connections | — | R if seeker or solver party; C via RPC | parties R; status via RPC | R |
| connection_events | — | R if party | — | R |
| conversations / participants | — | R if participant | participant R; own `last_read_at` U | R (only when linked to report/dispute) |
| messages | — | R/C if conversation participant & not blocked; U own (edit ≤15 min) | participant | R only via report/dispute context; `hidden` U |
| attachments (row) | — | R/C if case participant | participant | R in report context |
| storage `attachments` | — | read via signed URL after participant check | upload: participant, path prefix = case_id | read in report context |
| notifications | — | R/U(read_at)/D own | own | — |
| milestones, tasks, progress_updates | — | R participant; C/U participant (solver or owner); D owner only | participant | R |
| resolutions | — | R participant; via RPC | seeker confirms | R |
| feedback | — | R own received/given; C via RPC | — | R |
| resources | R available `offer` (public fields) | R available; CRUD own | owner | CRUD |
| groups / group_members | R public group info | C group; R members if member | group_admin: U/manage members | CRUD |
| reports | — | C own; R own | — | R/U |
| moderation_actions, disputes | — | disputes: R/C if party | — | CRUD |
| verifications | — | C/R own | — | R/U |
| storage `verification-docs` | — | owner upload/read own | — | read |
| audit_log | — | — | — | R (no U/D for anyone) |
| system_settings | R whitelisted public keys (banner, registration_open) | same | — | CRUD |
| rate_limits, ai_calls | — | — | — | R; written by definer/service |
| data_requests | — | C/R own | — | R/U |

## 3. Key Rule Details

1. **Blocks:** `is_blocked_between(a,b)` is checked in policies for profiles view, matches eligibility, connection RPC, message insert, and conversation select. Blocked users cannot discover, request, or message each other.
2. **Messaging gate:** `messages` insert requires conversation participant AND connection in `accepted` (except `clarification` conversations: pre-acceptance, text only, max 3 messages per side enforced by trigger).
3. **Status columns are RPC-only:** no UPDATE policy touches `cases.status`, `connections.status`, `profiles.status/is_admin/verification`; column privileges revoked from `authenticated`, granted only inside definer functions.
4. **Case visibility:**
   - `private` — owner, participants, admin.
   - `matched_only` — plus solvers who have a `matches` row for the case see the *summary* (no raw_text/owner identity until a request is sent).
   - `public_anonymised` — `public_cases_view` exposes title, summary, category, city/state, urgency, skills (no owner, raw_text).
5. **Profile exposure:** `public_profile_view` returns display_name, headline, avatar, city (if `privacy.show_city`), skills with proficiency, verification, availability_status, reliability (if computable). Email/phone are never exposed.
6. **Ownership transfer / role escalation:** impossible from client; `is_admin` only set by service/SQL.
7. **Files:** private bucket policies check participation via `is_case_participant((storage.foldername(name))[1]::uuid)`; downloads through `signed-file-url` (60 s TTL); filenames sanitised; MIME allow-list enforced server-side.
8. **Feedback integrity:** `submit_feedback` verifies case `resolved`, both users participants, one record per pair, not self.
9. **Admin actions:** all via `admin-ops`/RPCs that write `audit_log`. Admin reading private conversations is allowed **only** with an open report/dispute referencing it (checked in policy; access logged).
10. **Rate limits:** requests, cases, reports, AI calls, signups per IP/user (`check_rate_limit`).

## 4. Route-Level Access (UI guards — convenience only)

| Route group | Requirement |
|---|---|
| Public | none |
| `/app/*` | signed in + active |
| `/app/*` (except onboarding) | `onboarded_at` set |
| `/app/cases/:id/*` | owner or participant (else 404, not 403, to avoid leaking existence) |
| `/admin/*` | `is_admin` |

## 5. Policy Testing (pgTAP)
For each table: anon denied, member A cannot read/write member B's private rows, participant vs non-participant, blocked pair, suspended user, admin allowed. Required to pass in CI before any migration merges.

## 6. Secrets & Keys
- Client: publishable/anon key only.
- **Never** place `service_role` or `sb_secret_*` keys in `.env.example`, source, client bundles, or commits. Server secrets live in Supabase Edge Function secrets / CI secret store. A leaked secret key must be rotated immediately in the Supabase dashboard.
