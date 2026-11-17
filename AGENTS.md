# AGENTS.md

Follow these rules in every task, without exception.

## Details

- [Visual rules](docs/DESIGN.md)
- [Workflow and wording rules](docs/UX.md)
- [Build discipline](docs/SCOPE.md)
- [3-hour plan and progress](docs/TASKS.md)

Read the linked file before working on that area.

## Who we build for

- The end user is not a developer. Every screen, label and message must make sense to a non-technical person.
- Use simple, everyday words everywhere: UI text, error messages and your own explanations to me.
- Avoid technical terms. Say "Couldn't save. Please try again" instead of "500 server error".

## Tech stack

- Vite + React (JavaScript), Tailwind CSS, Supabase.
- `lucide-react` for icons.
- `react-router-dom` for routing.
- Don't add any other framework, UI library or package without asking me first.

## Project structure

- `src/pages/`: one file per page.
- `src/components/`: reusable pieces (Button, Modal, IconButton, Tooltip, EmptyState, Toast, ConfirmDialog).
- `src/lib/supabase.js`: the single Supabase client.
- `src/services/`: all database calls, one file per feature (for example `clients.js`). Pages and components never call Supabase directly.
- `src/hooks/`: shared hooks.
- `supabase/schema.sql`: tables and policies.
- Keep each file small and focused on one thing.

## Supabase

- Keys live in `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never commit `.env`. Keep `.env.example` up to date.
- Never use the service role key in the frontend.
- Turn on Row Level Security for every table, with a simple policy.
- Use Supabase Auth with email and password, unless I say otherwise.
- Every service call must handle errors. Show a plain-language message and never show raw error text.

## Data, state and routing

- Keep state simple: React state and context. No Redux or other state libraries.
- Load data in one place per page, with a loading state and an empty state.
- After a create, edit or delete, refresh the list automatically.
- Keep the route list short, in one file. Protect pages that need login.

## Quality checks

- `npm run dev` and `npm run build` must both work before a task is done.
- No console errors or warnings.
- Test the main flow once at mobile width before finishing a task.

## Communication

- Keep replies short and in simple language. Say what you did and what I need to check.
- If something is unclear, ask one short question instead of guessing.
- No long explanations or summaries unless I ask.
