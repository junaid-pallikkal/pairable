# SOLVIA — Database

PostgreSQL (Supabase). All tables in `public` unless noted. RLS **enabled on every table** (policies in PERMISSIONS.md). Naming: snake_case, plural tables, `uuid` PKs via `gen_random_uuid()`, `timestamptz` timestamps, `created_at`/`updated_at` everywhere.

Extensions: `pgcrypto`, `pg_trgm`, `unaccent`, `pg_cron`.

## 1. Entity Relationship (overview)

```
auth.users 1─1 profiles ─┬─< user_skills >─ skills >─ categories
                         ├─< availability_windows
                         ├─< group_members >─ groups
                         ├─< blocks / reports / verifications
                         └─< cases ─┬─< case_skills >─ skills
                                    ├─< case_events
                                    ├─< matching_runs ─< matches ─> (profile | group | resource)
                                    ├─< connections ─< connection_events
                                    │        └─ conversation (1:1) ─< messages ─< attachments
                                    ├─< case_participants
                                    ├─< tasks · milestones · progress_updates
                                    ├─< resolutions
                                    └─< feedback
resources ─< resource_requests (links to cases/connections)
notifications · audit_log · moderation_actions · disputes · system_settings · matching_config · rate_limits · ai_calls
```

## 2. Enumerations

```sql
create type app_intent        as enum ('seeker','solver','both');
create type account_status    as enum ('active','suspended','banned','deleted');
create type verification_level as enum ('none','email','phone','document');
create type help_type         as enum ('advice','hands_on','mentoring','review','introduction','resource_lend','other');
create type urgency_level     as enum ('flexible','this_month','this_week','urgent');
create type case_status       as enum ('draft','open','matching','in_progress','resolved','closed','cancelled');
create type case_visibility   as enum ('private','matched_only','public_anonymised');
create type connection_status as enum ('draft','pending','clarification_requested','accepted','declined','cancelled','expired','closed');
create type party_kind        as enum ('user','group');
create type match_model       as enum ('group_group','skill_skill','resource_resource','group_skill','group_resource','skill_resource');
create type run_status        as enum ('queued','running','complete','failed');
create type task_status       as enum ('todo','doing','done');
create type milestone_status  as enum ('pending','active','done');
create type resource_direction as enum ('offer','request');
create type resource_status   as enum ('available','reserved','unavailable','archived');
create type report_target     as enum ('user','case','message','resource','group');
create type report_status     as enum ('open','reviewing','actioned','dismissed');
create type dispute_status    as enum ('open','mediating','resolved','escalated');
create type notification_kind as enum ('request_received','request_accepted','request_declined','clarification','message','task_assigned','milestone','resolution_proposed','resolution_confirmed','feedback_request','report_update','verification_update','system');
```

## 3. Tables

Legend: **PK**, *FK*, `U` unique, `N` nullable, `idx` indexed.

### 3.1 Identity & Profile

**profiles** (1:1 with `auth.users`)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = auth.users.id, FK on delete cascade |
| display_name | text | 2–60 chars |
| handle | citext U | optional public handle |
| headline | text N | ≤120 |
| bio | text N | ≤1500 |
| avatar_url | text N | |
| intent | app_intent | from onboarding |
| city, state | text N | India; city-level only |
| country | text | default `'IN'` |
| remote_ok | bool | default true |
| languages | text[] | default `{'en'}` |
| timezone | text | default `'Asia/Kolkata'` |
| comm_prefs | text[] | e.g. chat, call, video |
| help_types | help_type[] | what they offer |
| budget_min, budget_max | int N | INR; informational |
| verification | verification_level | default none (derived/maintained by admin or triggers) |
| status | account_status | default active |
| is_admin | bool | default false; **not user-writable** |
| onboarded_at | timestamptz N | |
| privacy | jsonb | `{show_city, show_last_active, discoverable}` |
| search | tsvector | generated from name, headline, bio; GIN idx |
| created_at, updated_at | timestamptz | |

**skills** — canonical skill taxonomy
`id, name citext U, slug U, category_id FK, is_approved bool, created_by FK N, created_at`. Trigram idx on name. User-proposed skills start `is_approved=false` (usable by proposer; admin approves/merges).

**categories** — `id, name U, slug U, parent_id FK N, icon text N, sort int, is_active bool`.

**user_skills** — `id, user_id FK, skill_id FK, proficiency smallint (1–4: basic..expert), years numeric(3,1) N, evidence jsonb[]` U(user_id, skill_id).
Evidence item shape: `{type:'link'|'text'|'credential', label, url?}`; shown as user-provided, not platform-verified, unless `verified_by` set.
Add `verified_by uuid N` (admin) and `verified_at`.

**availability_windows** — `id, user_id FK, weekday smallint 0–6, start_time time, end_time time` ; plus `profiles.availability_status` enum-like text (`open|limited|unavailable`, default open) — add column `availability_status text check (...)`.

**verifications** — `id, user_id FK, level verification_level, document_path text N (private bucket), status text (submitted|approved|rejected), reviewer_id FK N, reviewed_at N, note N, created_at`.

**blocks** — `blocker_id FK, blocked_id FK, created_at` PK(blocker_id, blocked_id).

### 3.2 Groups

**groups** — `id, name, slug U, description, city, state, is_organization bool, verified bool, created_by FK, status account_status, created_at, updated_at`.
**group_members** — `group_id FK, user_id FK, role text check in ('owner','admin','member'), joined_at` PK(group_id, user_id).
**group_skills** — `group_id, skill_id, proficiency` PK(group_id, skill_id).

### 3.3 Cases

**cases**
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| owner_id | FK profiles | |
| group_id | FK N | case owned on behalf of group |
| title | text | ≤140 |
| raw_text | text | original description ≤5000 |
| summary | text N | confirmed interpretation |
| category_id | FK N | |
| status | case_status | default draft; changed via RPC |
| visibility | case_visibility | default private |
| urgency | urgency_level N | |
| city, state | text N | |
| remote_ok | bool | |
| budget_min, budget_max | int N | INR |
| help_types | help_type[] | |
| interpretation | jsonb N | AI/manual structured output (versioned) |
| interpretation_source | text | `ai` \| `manual` \| `ai_edited` |
| confirmed_at | timestamptz N | user confirmed interpretation |
| resolved_at, closed_at | timestamptz N | |
| search | tsvector | generated; GIN |
| content_hash | text | duplicate detection |
| created_at, updated_at | | |
idx: (owner_id), (status, visibility), search GIN, (category_id).

**case_skills** — `case_id FK, skill_id FK, importance smallint (1–3)` PK both.
**case_events** — `id, case_id FK, actor_id FK N, kind text, data jsonb, created_at` (timeline; append-only).
**case_participants** — `case_id FK, user_id FK, role text ('owner','solver','observer'), joined_at` PK(case_id,user_id). Rows for solvers created on connection acceptance.

### 3.4 Matching

**matching_config** — `id, version int U, weights jsonb, params jsonb (top_n, min_score), is_active bool, created_by FK, created_at`. Exactly one active (partial unique index).
**matching_runs** — `id, case_id FK, config_version int, status run_status, candidate_count int N, error text N, started_at, finished_at N, requested_by FK`.
**matches**
| Column | Notes |
|---|---|
| id | PK |
| run_id FK, case_id FK | |
| model | match_model |
| party_kind | party_kind N (null for resource-only) |
| profile_id FK N · group_id FK N · resource_id FK N | exactly one populated (check) |
| rank int | |
| score numeric(5,4) | |
| score_breakdown jsonb | `{factor:{value,weight,included,reason}}` |
| explanation text | built from breakdown |
| missing_info text[] | factors not provided |
| created_at | |
U(run_id, rank). Matches are immutable snapshots.

**match_feedback** — `id, match_id FK, user_id FK, relevant bool, reason text N, created_at` (tunes engine; no effect on ranking in MVP besides admin review).

### 3.5 Connections & Messaging

**connections**
`id, case_id FK, seeker_id FK, solver_profile_id FK N, solver_group_id FK N, resource_id FK N, initiated_by FK, status connection_status, message text (≤500), match_id FK N, responded_at N, expires_at, created_at, updated_at`.
Check: exactly one of solver_profile_id/solver_group_id/resource_id. Partial unique: one open (`pending|clarification_requested|accepted`) per (case_id, solver target).
**connection_events** — `id, connection_id FK, actor_id FK, from_status, to_status, note N, created_at`.
**conversations** — `id, case_id FK, connection_id FK U N, kind text ('clarification','case_direct','case_group'), created_at`.
**conversation_participants** — `conversation_id FK, user_id FK, last_read_at, muted bool` PK both.
**messages** — `id, conversation_id FK, sender_id FK, body text (≤4000), kind text ('text','system','progress'), reply_to FK N, hidden bool default false, created_at, edited_at N`. idx (conversation_id, created_at).
**attachments** — `id, case_id FK, message_id FK N, uploader_id FK, path text, filename, mime, size_bytes int, created_at`.
**notifications** — `id, user_id FK, kind notification_kind, title, body N, link text N, data jsonb, read_at N, emailed_at N, created_at`. idx (user_id, read_at, created_at desc).

### 3.6 Collaboration

**milestones** — `id, case_id FK, title, description N, position int, status milestone_status, due_date N, completed_at N, created_by FK`.
**tasks** — `id, case_id FK, milestone_id FK N, title, description N, assignee_id FK N, status task_status, due_date N, created_by FK, created_at, updated_at`.
**progress_updates** — `id, case_id FK, author_id FK, body, created_at`.
**resolutions** — `id, case_id FK, proposed_by FK, status text ('proposed','confirmed','rejected'), summary text, confirmed_by FK N, confirmed_at N, reopen_until timestamptz N, created_at`.
**feedback** — `id, case_id FK, from_user FK, to_user FK, outcome text ('resolved','partially','not_resolved'), rating smallint 1–5 N, comment text N, created_at` U(case_id, from_user, to_user). Check from≠to; inserted only via RPC verifying both are participants and case is resolved.

### 3.7 Resources

**resources** — `id, owner_id FK, group_id FK N, direction resource_direction, title, description, category_id FK, kind text ('physical','digital','space'), city, state, remote_ok bool, status resource_status, quantity int default 1, available_from N, available_until N, search tsvector, created_at, updated_at`.
**resource_requests** — `id, resource_id FK, requester_id FK, case_id FK N, status connection_status, message, created_at` (reuses status machine; MVP may fold into `connections.resource_id` — see Decision D-DB-1).

> **D-DB-1:** MVP uses `connections.resource_id` instead of a separate `resource_requests` table. `resource_requests` is omitted unless quantity/booking logic becomes necessary. (Table listed for reference; do **not** create in migration 006 unless approved.)

### 3.8 Trust, Admin & Platform

**reports** — `id, reporter_id FK, target_type report_target, target_id uuid, reason text (enum-checked), details N, status report_status, assigned_to FK N, created_at, resolved_at N`.
**moderation_actions** — `id, report_id FK N, admin_id FK, target_type, target_id, action text ('dismiss','warn','hide','suspend','ban','restore'), reason, created_at`.
**disputes** — `id, case_id FK, opened_by FK, against FK N, reason, status dispute_status, assigned_admin FK N, resolution_note N, created_at, resolved_at N`.
**audit_log** — `id bigserial, actor_id FK N, action, entity, entity_id, before jsonb, after jsonb, ip inet N, created_at` (append-only).
**system_settings** — `key text PK, value jsonb, updated_by FK N, updated_at` (flags, rate limits, `ai_enabled`, `request_expiry_days`, banners).
**rate_limits** — `key text, window_start timestamptz, count int` PK(key, window_start).
**ai_calls** — `id, user_id FK, function text, input_hash, status, latency_ms, tokens_in, tokens_out, created_at`.
**data_requests** — `id, user_id FK, kind ('export','delete'), status, created_at, fulfilled_at N`.

## 4. Functions, Triggers & Views

| Name | Type | Purpose |
|---|---|---|
| `handle_new_user()` | trigger on auth.users | create `profiles` row |
| `set_updated_at()` | trigger | maintain `updated_at` |
| `is_admin()` | SQL fn, definer | `exists(select 1 from profiles where id=auth.uid() and is_admin and status='active')` |
| `is_case_participant(case_id)` | SQL fn | owner or in `case_participants` |
| `is_blocked_between(a,b)` | SQL fn | either direction |
| `transition_case(case_id, action)` | RPC | enforces case lifecycle |
| `transition_connection(id, action, note)` | RPC | state machine, events, conversation creation, notifications |
| `send_connection_request(...)` | RPC | validates eligibility, rate limits, duplicates |
| `propose_resolution / confirm_resolution / reopen_case` | RPC | resolution flow |
| `submit_feedback(...)` | RPC | participant & status checks |
| `check_rate_limit(key,limit,window)` | RPC | abuse control |
| `match_candidates(case_id)` | SQL fn | retrieval + hard eligibility filters (used by `run-matching`) |
| `public_profile_view` | view (security invoker) | safe subset of profile columns honoring privacy flags |
| `public_cases_view` | view | anonymised public case cards |
| `user_reliability(user_id)` | SQL fn | confirmed ÷ accepted, null if <3 |
| `expire_connections()` | pg_cron every hour | pending past `expires_at` → expired |

Triggers also: `notifications` insert on connection/message events; `case_events` append on status changes; block of direct `UPDATE` of `status`/`is_admin`/`verification` columns by non-definer roles (via column privileges or trigger).

## 5. Indexing Summary
GIN: `profiles.search`, `cases.search`, `resources.search`. Trigram: `skills.name`. btree: all FKs; `(case_id, status)` on connections; `(conversation_id, created_at)` on messages; `(user_id, read_at)` on notifications; partial unique indexes noted above.

## 6. Seed Data (all environments — reference data only)

**Categories (initial):** Technology & Software · Business & Startups · Legal & Compliance · Finance & Accounting · Education & Career · Health & Wellbeing (non-clinical guidance only) · Design & Creative · Home & Local Services · Community & Social Impact · Research & Academia · Agriculture & Rural · Government & Documentation · Other.

**Skills:** ~150 curated starter skills across the categories (e.g., Python, React, UI design, GST filing, contract review, resume review, SEO, public speaking, 3D printing, soil testing).

**matching_config v1:** weights from ARCHITECTURE §6.2, `top_n=20`.
**system_settings:** `ai_enabled=true`, `request_expiry_days=14`, `max_pending_requests=10`, `max_requests_per_case_per_day=5`, `registration_open=true`.

Demo/sample users, cases and solvers exist **only** in local/staging seed (`supabase/seed.dev.sql`) and are clearly labelled; never in prod.

## 7. Migration Plan
| # | Contents | Phase |
|---|---|---|
| 001 | extensions, enums, profiles, categories, skills, user_skills, availability, blocks, system_settings, helpers, auth trigger | 3 |
| 002 | cases, case_skills, case_events, case_participants, case views, FTS | 4 |
| 003 | matching_config, matching_runs, matches, match_feedback, `match_candidates` | 5 |
| 004 | connections, events, conversations, messages, notifications, RPCs, cron | 6 |
| 005 | milestones, tasks, progress_updates, attachments, resolutions, feedback, storage policies | 7 |
| 006 | resources, groups, reports, moderation_actions, verifications, disputes, audit_log, rate_limits, ai_calls, data_requests | 9 (rate_limits & ai_calls pulled forward to 3/8 as needed) |

Rules: forward-only; each migration includes RLS + indexes + pgTAP tests; regenerate TS types after each.
