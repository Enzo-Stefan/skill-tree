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

`profiles` (display name, country, continent, city, hemisphere, opt-in), `leaderboard_scores` (filled by a trigger on `progress`, never by the app) and `leaderboard_reports`. Players read only their own profile; nobody reads scores or reports directly. The ranking comes from `public.leaderboard(...)`, which returns opted-in players only and never the city. `leaderboard_reports` and `report_row` exist in the database, but no app UI writes to them yet. Run 005 before the app version that uses it ships. The SQL is tested with `npm test` (`supabase/tests/`), which runs the migrations in an in-memory Postgres.

## Report emails (notify-report)

`supabase/functions/notify-report` emails the admins for every new report. It needs migration 006 first (it counts open reports by `status`). At most 10 emails an hour, then one summary email, then none until the hour passes. The email is plain text: report id, reported player's name, the reason, the open count and a link to `/#admin`. It has no reporter and no user id.

Set up (once, by an admin):

1. Resend: make an API key, and a sender it allows. The free test sender only delivers to the Resend account owner, so mailing two people needs a verified domain, or one address that forwards to the other.
2. `supabase secrets set WEBHOOK_SECRET=<long random> RESEND_API_KEY=<key> ADMIN_EMAILS=a@x.com,b@y.com EMAIL_FROM="Skill Tree <reports@your-domain>" APP_URL=https://<the app address>`
3. `supabase functions deploy notify-report --no-verify-jwt` (the webhook proves itself with the secret instead of a login).
4. Dashboard, Database, Webhooks: new webhook on table `leaderboard_reports`, event Insert, type Supabase Edge Function, function `notify-report`, with the HTTP header `x-webhook-secret: <the same WEBHOOK_SECRET>`.

A failed email does not fail the report. The webhook is asynchronous, so a mail outage only delays the email; the report still shows on the admin page. Tested in `supabase/tests/notifyReport.test.ts` (the parts that need no network).

## Free plan

Free projects pause after a week with no activity. If sign-in stops working, open the project
in Supabase and click **Restore**.
