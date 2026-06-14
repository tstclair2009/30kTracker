# The Galactic War

A community war ledger for the Horus Heresy: **Next.js (App Router) + Supabase (Postgres) + Supabase Auth** with Google and Facebook SSO. Players sign in, submit battle results, and contribute to a galaxy-wide loyalist-vs-traitor tug of war, with ranks, profiles, a searchable public ledger, and admin tools.

Deployed on **Vercel** (the app) + **Supabase** (database & auth). Two managed clouds, no servers to run.

## Architecture

- **`src/app`** — App Router pages. Server Components fetch data from Supabase as the signed-in user, so Row-Level Security applies. Client Components handle interactivity (auth, search, admin actions).
- **`src/lib/data.ts`** — read queries wrapping the SQL views and RPCs.
- **`src/app/actions.ts`**, **`admin/admin-actions.ts`**, **`ledger/search-action.ts`** — Server Actions for writes and privileged calls.
- **`supabase/migrations`** — the schema. `0001_init.sql` = tables, views, RLS, triggers; `0002_rpcs.sql` = admin/search functions.

The database enforces the rules, not the UI: a player can only insert battles as themselves into the open season (RLS), and admin actions are re-checked in SQL. The "reset" is a season model — resetting closes the current season and opens a new one; old battles keep their `season_id`, so history is preserved automatically.

---

## Deploy (start to finish, ~20 min)

### 1. Supabase — stand up the backend
1. Create a project at [supabase.com](https://supabase.com). Save the DB password.
2. **SQL Editor** -> run the migrations in order: paste all of `supabase/migrations/0001_init.sql` and run it, then `supabase/migrations/0002_rpcs.sql` and run it. This creates tables, indexes, views, RLS policies, the new-user trigger, and opens the first season.
3. **Settings -> API** -> copy these three:
   - **Project URL**
   - **anon public** key
   - **service_role** key (secret)

### 2. Push to GitHub
The unzipped folder IS the repo root (`package.json` is at the top level — important for Vercel). Create an empty GitHub repo (no README/license), then:
```bash
git init
git add -A
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/galactic-war.git
git branch -M main
git push -u origin main
```

### 3. Vercel — import & set env vars
1. Sign in to [vercel.com](https://vercel.com) **with GitHub**.
2. **Add New -> Project** -> import the repo. The included `vercel.json` pins the framework to Next.js, so detection is automatic — leave build settings at their defaults.
3. Expand **Environment Variables** and add all four:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |
   | `NEXT_PUBLIC_SITE_URL` | leave blank for now |

4. **Deploy.** You'll get a URL like `galactic-war-xyz.vercel.app`.

### 4. Set the site URL, redeploy
`NEXT_PUBLIC_*` vars are baked in at build time, so once you know your URL: **Settings -> Environment Variables** -> set `NEXT_PUBLIC_SITE_URL` to `https://your-vercel-url` -> **Deployments -> ... -> Redeploy**.

### 5. Wire up OAuth (the step that silently breaks sign-in)
All three must point at your final URL:
- **Supabase -> Authentication -> URL Configuration** -> **Site URL** = your Vercel URL; add `https://your-vercel-url/**` to the redirect allow-list.
- **Google Cloud Console** -> OAuth credentials -> authorized redirect URI = `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
- **Facebook Developers** -> app -> valid OAuth redirect URI = same Supabase callback URL.

To enable the providers themselves: **Supabase -> Authentication -> Providers -> Google / Facebook**, paste each provider's Client ID + Secret, enable.

### 6. Make yourself admin
Sign in once (creates your profile row), then in Supabase SQL Editor:
```sql
update public.profiles set is_admin = true where handle = 'YOUR_HANDLE';
```
Check the `profiles` table for your auto-generated handle. The admin link appears after that.

---

## Day-to-day
Every `git push` to `main` auto-deploys. Pull requests get their own preview URLs. No build commands to run by hand.

## Local development
```bash
cp .env.local.example .env.local   # fill in the four Supabase values
npm install
npm run dev                        # http://localhost:3000
```
For local OAuth, add `http://localhost:3000` to the Supabase redirect allow-list and set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` in `.env.local`.

## Notes
- **Free tiers:** Vercel Hobby (non-commercial) and Supabase free tier both cover a project this size. Supabase pauses a free project after ~1 week of inactivity; the first request after a pause is slow while it wakes.
- **Rank ladder** lives in two places that must stay in sync if retuned: `src/lib/ranks.ts` (display) and `public.rank_title()` in `0001_init.sql` (SQL). Both currently match: Aspirant 0 -> Neophyte 200 -> ... -> Primarch 10000.
- **Allegiance** is chosen per battle, not locked to the account.
- **Next features** the data already supports: per-event leaderboards (`event` column is indexed), a one-time "claim your handle" rename flow, and a cron-driven annual reset via Supabase `pg_cron`.
