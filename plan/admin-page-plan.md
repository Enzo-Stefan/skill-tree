# Admin page and report emails (plan for #104)

Status: proposal, for Stefan's yes. Nothing here is built.

## Goal

When a player reports a leaderboard row, both admins (Enzo and Stefan) get an email, and can open an admin page in the app to read the report and act on it. Today reports sit in `leaderboard_reports` and can only be read in the Supabase dashboard.

## What exists

- `leaderboard_reports` (migration 005): `id`, `reporter_id`, `reported_id`, `reason` (1 to 300 characters), `created_at`. One report per reporter and reported player. Row-level security is on and nothing is granted to `anon` or `authenticated`, so only `report_row()` writes to it.
- `report_row(row_key, reason)` limits a player to 10 reports per 24 hours.
- `profiles.leaderboard_opt_in` decides whether a row appears. Players can write that column themselves, so setting it to false is not enough to keep a reported player off the board.
- The Report button and dialog are not in the app yet (#104). The admin page has nothing to show until they are.

## Decisions already made

- Admins are Enzo and Stefan.
- An email is sent for every new report.

## Design

### 1. Who is an admin

A new table `public.admins (user_id uuid primary key references auth.users on delete cascade)`, with no policies and no grants. Two rows, inserted by hand in the SQL editor (the user ids are not in the repo). A `security definer` function `is_admin()` returns whether `auth.uid()` is in that table. Every admin function below calls it first and raises an error for anyone else.

No passphrase and no client-side check: the page is only a view, and the database enforces access.

### 2. Report status and hiding a row (migration 006, Stefan)

- `leaderboard_reports` gets `status` (`open`, `dismissed`, `actioned`; default `open`), `resolved_by` and `resolved_at`.
- `profiles` gets `leaderboard_hidden_at timestamptz`. `leaderboard()` skips rows where it is set, and players cannot write it because the column is outside their `grant update (...)` list. This is what makes "hide" stick: a player cannot switch the row back on with `leaderboard_opt_in`.
- `admin_list_reports(status text)` returns, per reported player: display name, country, whether the row is hidden, the number of open reports, and each report's reason and date. It never returns city or user ids.
- `admin_resolve_report(report_id bigint, action text)`:
  - `dismiss` marks the report `dismissed`.
  - `hide` sets `leaderboard_hidden_at` on the reported player and marks all their open reports `actioned`.
  - `unhide` clears `leaderboard_hidden_at`. This keeps hiding reversible.
- Both functions are `security definer`, check `is_admin()`, and are granted to `authenticated` only.

Open question: should admins see who reported? Recommendation: show the reporter's display name, because it helps spot one player reporting many others, and say so in `privacy.html`.

### 3. The admin page (Enzo)

- Route: `/#admin`, loaded as a separate lazy chunk so players never download it.
- It uses the existing Google sign-in. If the signed-in user is not an admin, it shows the same "not found" screen as an unknown route, and says nothing about an admin page existing.
- List of open reports grouped by reported player, newest first. Each group shows the reasons, the report count and the row's current state.
- Buttons: **Hide row**, **Dismiss** and, on hidden rows, **Unhide**. Hide asks for confirmation.
- A tab for resolved reports, so a past decision can be checked.
- English only. The page is for the two of us.
- Component tests for the list, the confirmation and the not-an-admin screen.

### 4. Email when a report arrives

- A Supabase Database Webhook fires on `insert` into `leaderboard_reports` and calls an Edge Function, `notify-report`.
- The function checks a shared-secret header (stored as a function secret), then sends one plain-text email to both admin addresses through Resend. It does not render HTML, because `reason` is player-written text.
- The email contains: the report id, the reported player's display name, the reason, the number of open reports for that player and a link to `/#admin`. It does not include the reporter's identity or any user id.
- Secrets (`RESEND_API_KEY`, `ADMIN_EMAILS`, the webhook secret) live in Supabase function secrets. Nothing goes in the repo, and the `service_role` key is not used in the app.
- Flood protection: the function sends at most 10 emails per hour and then one summary email ("N more reports, see the admin page"). This guards against many throwaway accounts reporting at once; the per-player limit in `report_row()` does not.
- A failed email must not fail the report: the webhook is asynchronous, so a mail outage only delays the notification, and the report still shows on the admin page.
- To verify before building: Resend's free test sender only delivers to the account owner's address. Mailing both of us needs either a verified sending domain or one address that forwards to the other. If neither is available, the fallback is one email to one admin.

### 5. Privacy text

Update `public/privacy.html` in the same PR as the admin page: reports are read by the Skill Tree admins; a reported row may be hidden; admins can see the reporter's display name; the report email contains the report reason.

## Order of work

1. **#104 first (Enzo):** Report button and dialog, `privacy.html` text, dialog tests. Without it there are no reports.
2. **Migration 006 and SQL tests (Stefan):** `admins`, report status, hidden flag, the two admin functions. Run it in Supabase before merging, because `main` deploys itself.
3. **Admin page (Enzo):** after 006 is live.
4. **Email function (Stefan):** after the webhook sender question above is answered. It is independent of step 3, so the two can go in either order.

One branch and one PR per step, each reviewed by the other person.

## Decisions for Stefan

1. Show the reporter's display name to admins? (Recommended: yes.)
2. Is hiding a row permanent until an admin unhides it? (Recommended: yes, as above.)
3. Which email sender: a verified domain, or one forwarding address?
4. Spanish wording on the Report button: "Reportar" (recommended) or "Denunciar".

Relates to #96, #103 and #104.
