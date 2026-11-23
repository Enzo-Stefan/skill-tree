# Supabase setup

Accounts are optional. Without them the app saves progress in the browser, like before.
Signing in with Google syncs progress across devices. Plan: issue #5.

## One-time setup (Stefan)

1. **Create the project.** At supabase.com, sign in with GitHub, click **New project**.
   Name it `skill-tree`, pick the region closest to your players, save the database password somewhere safe.
2. **Create the table.** In the project: **SQL Editor → New query**, paste all of
   `migrations/001_progress.sql`, click **Run**. Running it twice is safe.
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
and the level-up checkpoint. Row-level security means a signed-in player can only read and
write their own rows, and signed-out visitors can read nothing. Deleting a user deletes their rows.

## Free plan

Free projects pause after a week with no activity. If sign-in stops working, open the project
in Supabase and click **Restore**.
