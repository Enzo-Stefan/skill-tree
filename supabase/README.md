# Supabase setup

Accounts are optional. Without them the app saves progress in the browser, like before.
Signing in with Google syncs progress across devices. Plan: issue #5.

## One-time setup (Stefan)

1. **Create the project.** At supabase.com, sign in with GitHub, click **New project**.
   Name it `skill-tree`, pick the region closest to your players, save the database password somewhere safe.
2. **Create the table.** In the project: **SQL Editor → New query**, paste all of
   `migrations/001_progress.sql`, click **Run**. Running it twice is safe.
   Then do the same with `migrations/002_delete_account.sql`, which lets players delete their own account in the app,
   and `migrations/003_lift_log_and_results.sql`, which saves the lift log and test results to the account.
   Run 003 before the app version that uses it goes live, or loading and saving progress fails.
   Then `migrations/004_sessions.sql`, which saves which skills were trained each day. Same rule: run it before
   merging the code that uses it, because `main` deploys itself.
3. **Google sign-in.**
   - In Google Cloud Console, create an OAuth client (type: Web application).
     Authorised redirect URI: the callback URL Supabase shows under
     **Authentication → Sign In / Providers → Google** (it ends in `/auth/v1/callback`).
   - Paste the Google client ID and secret into that Supabase Google provider and turn it on.
4. **Allowed URLs.** **Authentication → URL Configuration**:
   - Site URL: `https://skill-tree-5y8k.vercel.app`
   - Redirect URLs: `https://skill-tree-5y8k.vercel.app/**` and
     `https://skill-tree-*-gjinistefan00-lgtm.vercel.app/**` (PR previews) and
     `http://localhost:5173/**` (local dev).
5. **Keys in Vercel.** From **Project Settings → API**, copy the Project URL and the `anon` public key.
   In Vercel: **skill-tree → Settings → Environment Variables**, add for Production and Preview:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   Then redeploy.
6. **Local dev.** Put the same two lines in `.env.local` in the repo root. It is git-ignored.

Never put the `service_role` key anywhere in this app. It bypasses all security rules.

## What's stored

One row per player per tree in `public.progress`: finished skill ids, chosen player level,
training check-in days, the streak state, the lift log and test results (the last two since 003). Row-level security means a signed-in player can only read and
write their own rows, and signed-out visitors can read nothing. Deleting a user deletes their rows.

Players delete their own account from the app (tap their name, then **Delete account**). That calls
`public.delete_my_account()`, which deletes only the signed-in caller's user, and their rows with it.

## Leaderboard (005)

`profiles` (display name, country, continent, city, hemisphere, opt-in), `leaderboard_scores` (filled by a trigger on `progress`, never by the app) and `leaderboard_reports`. Players read only their own profile; nobody reads scores or reports directly. The ranking comes from `public.leaderboard(...)`, which returns opted-in players only and never the city. Read reports in the dashboard under **Table Editor → leaderboard_reports**. Run 005 before the app version that uses it ships. The SQL is tested with `npm test` (`supabase/tests/`), which runs the migrations in an in-memory Postgres.

## Free plan

Free projects pause after a week with no activity. If sign-in stops working, open the project
in Supabase and click **Restore**.
