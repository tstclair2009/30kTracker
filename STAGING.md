# Separate Dev / Staging Environment

This guide stands up a **fully isolated** copy of the app — its own database, its own deployment, its own Stripe test sandbox — so you can build and test the events/monetization work without touching the live community app.

**Core principle:** a separate deployment needs its own *database*, not just its own URL. The isolation lives entirely in environment variables — the same code runs in both environments, pointed at different Supabase projects and Stripe keys.

```
                 ┌─────────────────────┐     ┌──────────────────────┐
   PRODUCTION    │ Vercel: live app    │────▶│ Supabase: live data  │
   (community)   │ heresywartracker.app│     │ (real players)       │
                 └─────────────────────┘     └──────────────────────┘

                 ┌─────────────────────┐     ┌──────────────────────┐
   DEV/STAGING   │ Vercel: staging app │────▶│ Supabase: staging DB │
   (your sandbox)│ staging.<...>       │     │ (test data only)     │
                 └─────────────────────┘     └──────────────────────┘
                          │
                          └──▶ Stripe TEST mode (fake cards, no real charges)
```

---

## 1. Create the staging Supabase project
1. New Supabase project — name it e.g. `heresy-staging`. Save the DB password.
2. **SQL Editor** → paste and run **`supabase/SETUP_FRESH_DB.sql`**. That single script builds the entire schema (core ledger + events Phase 1) in one shot.
   - *(Do not run the individual `000x` migrations on a fresh DB — the setup script already contains everything. The numbered migrations are for upgrading an existing database.)*
3. **Settings → API** → copy the Project URL, anon key, and service_role key.

## 2. Create the staging Vercel project
Two ways — pick one:

**A. Separate project (cleanest):** In Vercel, **Add New → Project**, import the same GitHub repo again, name it `galactic-war-staging`. This gives a completely independent deployment.

**B. Staging branch:** Push a `staging` branch; Vercel auto-creates a deployment for it. Use Vercel's per-environment env vars so the `staging` branch gets staging Supabase keys. (Only safe if you set the env vars carefully — option A is harder to get wrong.)

Set these env vars on the staging deployment (pointing at the **staging** Supabase, not production):
```
NEXT_PUBLIC_SUPABASE_URL=https://<staging-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging anon key>
SUPABASE_SERVICE_ROLE_KEY=<staging service_role key>
NEXT_PUBLIC_SITE_URL=https://<your-staging-url>
```

## 3. OAuth for staging
Google/Facebook are the one thing both environments can share, but each URL must be allow-listed:
- **Staging Supabase → Authentication → URL Configuration:** Site URL = your staging URL; add `https://<staging-url>/**` to redirect allow-list.
- **Google Cloud Console / Facebook:** add the staging Supabase callback (`https://<staging-project>.supabase.co/auth/v1/callback`) to the authorized redirect URIs. (The provider callback points at *Supabase*, so staging needs its own staging-Supabase callback added.)
- Enable Google/Facebook providers in the staging Supabase project and paste the same (or separate test) client IDs/secrets.

## 4. Make yourself admin + organizer on staging
After signing in once on staging, in the staging Supabase SQL editor:
```sql
update public.profiles
set is_admin = true, is_organizer = true, is_subscriber = true
where handle = 'YOUR_HANDLE';
```
Setting all three lets you exercise the full events flow immediately (admin tools + create/score events) before Stripe is wired.

## 5. Stripe test mode (when you build Phase 2)
Use Stripe **test mode** keys on staging — fake card numbers (e.g. `4242 4242 4242 4242`), no real charges ever. Production switches to live keys later. See `MONETIZATION.md` Phase 2 for the integration plan. Add to staging env vars when ready:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PRICE_ID=price_...
```

---

## Promote to production (when the events/monetization work is proven)

Production is currently at migration **0005**. To bring the events work live:

1. **Run `supabase/migrations/0006_events_phase1.sql`** in the **production** Supabase SQL editor. (Production already has 0001–0005, so it only needs 0006 — *not* the consolidated fresh-DB script, which would try to recreate existing objects.)
2. **Merge the code** to your main branch → production Vercel auto-deploys.
3. **Stripe:** switch staging's test keys for live keys in production env vars; point the Stripe webhook at the production URL.
4. **OAuth:** production redirect URLs are already set — no change unless you added new providers.
5. Verify on production: sign in, submit a global-war battle (unchanged), then exercise one event end-to-end.

### Migration state cheat-sheet
| Environment | Has through | Needs for events |
|---|---|---|
| Production (live) | 0005 | run 0006 |
| Fresh staging DB | — | run `SETUP_FRESH_DB.sql` (includes everything) |

---

## Keeping them straight
- **Same code, different config.** Never hardcode environment specifics; it's all env vars.
- **Never point staging at production data.** The #1 mistake — double-check `NEXT_PUBLIC_SUPABASE_URL` on staging is the *staging* project.
- **Test data stays in staging.** Fake events, test subscribers, and Stripe test charges never touch the live community.
- When in doubt about which DB you're looking at, check the project name in the Supabase dashboard header before running SQL.
