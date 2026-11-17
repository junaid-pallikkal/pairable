# RePair

Find your solver. Describe a problem, get ranked and explained matches, connect, collaborate, resolve.

Stack: Vite, React, TypeScript, Tailwind v4, Supabase (Postgres, Auth, Realtime, Edge Functions).
Docs are in [docs/](docs). Decisions that differ from the plan are in [docs/DECISIONS.md](docs/DECISIONS.md).

## Set up

1. Copy `.env.example` to `.env`. Fill in your Supabase URL and the **publishable** key. Never put a secret key here.
2. In the Supabase SQL editor, run these once, in order:
   1. `supabase/schema.sql`: tables, access rules, matching, connections, collaboration, seed skills.
   2. `supabase/assistant.sql`: hourly limit for the AI helper.
   3. `supabase/phase9.sql`: resources, blocking, reports, verification, admin tools.
   4. `supabase/ai_matching.sql`: free-text matching, notifications and swipe decisions (the main flow).
   5. Optional: `supabase/demo.sql` adds 6 demo people, 6 public problems and 6 resources so the app looks lived-in. Then `supabase/demo_stories.sql` adds the storytelling demo (see [docs/DEMO.md](docs/DEMO.md)). Remove all demo data any time with `supabase/demo_remove.sql`.
3. `npm install` then `npm run dev`.
4. Make yourself an admin (replace the email), in the SQL editor:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```
   Admin pages appear in the menu as **Admin**.

## Turn on the AI helper (optional)

The helper bubble works without AI (shortcuts only). To enable answers and "suggest details" in the composer:

1. Supabase dashboard, **Edge Functions**, create a function named `ai` and paste in `supabase/functions/ai/index.ts`. (Or: `npx supabase functions deploy ai`.)
2. In **Edge Functions, Secrets**, add `AI_API_KEY` (your Anthropic key). Optional: `AI_MODEL`.
3. The key stays on the server. It is never sent to the browser.

## Checks

```bash
npm run build        # typecheck and build
npm run lint
```

Integration test against your Supabase project (uses two confirmed test accounts; creates rows titled "E2E: ..."):

```bash
E2E_SEEKER_EMAIL=... E2E_SEEKER_PASSWORD=... E2E_SOLVER_EMAIL=... E2E_SOLVER_PASSWORD=... npm run test:e2e
```

Make the solver account an admin first to include the admin checks. Run it against a test project, not production.

Security audit: run `supabase/audit.sql` in the SQL editor. Checks 1 to 4 must return no rows.

## Deploy

Static site. Build with `npm run build` and host `dist/` on Vercel, Netlify or Cloudflare Pages. `vercel.json` and `public/_headers` already add the single-page fallback (Vercel) and security headers including a Content Security Policy.

## Launch checklist

- [ ] Use a separate production Supabase project. Run the three SQL files there.
- [ ] Turn on email confirmation and set a real SMTP sender (the built-in mailer is rate limited).
- [ ] Add your site URL to Supabase Auth redirect URLs, including `/reset-password` (used by the forgot-password email).
- [ ] Run `supabase/demo_remove.sql` so no demo people or problems appear in production.
- [ ] Rotate any key that was ever pasted into chat, a file or a commit.
- [ ] `supabase/audit.sql` returns no rows for checks 1 to 4.
- [ ] `npm run test:e2e` passes on a test project.
- [ ] Privacy and Terms pages reviewed by a lawyer (they are drafts).
- [ ] Admin accounts reviewed (audit check 6).
- [ ] Backups on (Supabase point-in-time recovery).
- [ ] Deploy `ai` function and key, or leave the helper in shortcut-only mode.
- [ ] Check on a real phone and with a screen reader.
