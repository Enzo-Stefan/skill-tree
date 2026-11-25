# Report button and dialog (plan for #104)

Status: proposal, for Stefan's yes. Nothing here is built on this branch. An implementation of the same button is open as #119 (branch `report-ui`, based on `main`), so decide which one to keep before building. Relates to #104, #109 and #119. #109 is a closed, unmerged plan PR (`admin-page-plan`); the admin page it planned was built anyway and is on `main`.

## Where this stands on main

This plan was first written against the code before `main` moved. As of `main` 3b53c08:

- Migration 005 (`supabase/migrations/005_leaderboard.sql`) creates `leaderboard_reports`, `leaderboard_keys` and the first `report_row`.
- Migration 006 (`supabase/migrations/006_admin_reports.sql`, from #115) replaces `report_row`, adds report status, the `admins` table, `leaderboard_hidden`, and the admin functions.
- The admin page (`src/admin/AdminPage.tsx`, #115) is on `main`. It lists open reports and shows the reporter's display name.
- The `notify-report` edge function (`supabase/functions/notify-report/`, #116) emails the admins on every insert into `leaderboard_reports`.

So the admin page and the emails already exist. The only missing piece is the button that creates reports. The earlier sentence "this task comes first, because the admin page and emails have nothing to show without the button" no longer holds as a dependency: the admin page and emails are already merged and will show reports as soon as the button creates them.

## Goal

A signed-in player can report another player's row on the leaderboard. The report goes to `leaderboard_reports`, where the admin page (#109) will show it. Without this button there are no reports to show.

## What exists

- Database: `report_row(row_key uuid, reason text)` and `leaderboard_reports` are defined in migration 005; migration 006 replaces `report_row` and adds report status. Whether 006 is applied on the live project is not verified here (see Order of work, step 1). This issue needs no migration and no SQL change.
- Reports are one open report per reporter and reported player (a partial unique index). A resolved report does not block a new report of the same player. A duplicate open report is a silent no-op: the insert uses `on conflict do nothing`, and no email is sent.
- Rate limit: at most 10 reports per reporter in any rolling 24 hours. The count includes resolved reports and is checked before the insert, so silent duplicates do not count.
- A report of a row that is unknown or your own is silently ignored: `report_row` returns without inserting. A hidden row is not ignored: migration 006's `report_row` does not check `leaderboard_hidden`, so a report that carries a key the client still holds is stored. `leaderboard()` leaves hidden rows out, so a fresh client cannot obtain such a key.
- Row key: `leaderboard()` returns a random `rowKey` for each row (`LeaderboardRow.rowKey` in `src/types.ts`). The app never sees user ids.
- The old UI was never merged to `main`. It lives on `origin/leaderboard-ui`: commit `f94b3ce` removed the Report button from that branch, so its parent `f94b3ce^` has the screen code to restore. Commit `2cba5fd`, which #104 names, adds tests and the test-library dev dependencies but no report code, so it is not the source.
- The old client call is out of date. It calls `report_row` with `reported_name` (the display name) and a three-option reason. Migration 005 takes `row_key` and a free-text reason (1 to 300 characters; blank is stored as "unspecified"). The client must be rewritten, not copied.
- Global scope needs no profile (`scopeAvailable` in `src/lib/leaderboardApi.ts`), so a signed-in player who never joined still sees the board and can report. The board is not fetched while signed out.
- `f94b3ce` also removed the `onMessage` prop from the screen (`App.tsx` passed `showToast`), the privacy sentence about reports, and changed a line in `supabase/README.md` to say no app UI writes reports yet. That README line still exists on `main`, and it says "Run 005", which is now incomplete because 006 is also needed.

## Signed-out path and error codes (checked against migration 006)

Migration 006 ends `report_row` with `revoke all ... from public, anon` and `grant execute ... to authenticated`. When a player's session has expired, the call runs as the `anon` role, so Postgres rejects it with SQLSTATE 42501 (permission denied for function) before the function body runs. The "Sign in to report a row." check (SQLSTATE 28000) inside the function is therefore not reached for an expired session. It is only a backstop for a signed-in call with no user id.

So the plan is:

1. Before calling the RPC, the dialog checks the session on the client (`supabase.auth.getSession()`). With no session, it shows the sign-in message with a Close button and does not call `report_row`. It does not start the sign-in flow.
2. If the session expires between that check and the call, error code 42501 maps to the same sign-in message. Error code 28000 does too.
3. Errors are matched on `error.code`, never on the message text.

The rate-limit error has a flaw here. `raise exception 'Too many reports today.'` has no `errcode`, so it carries Postgres's default SQLSTATE P0001, which any unqualified `raise` also produces. The code alone does not name the rate limit in general. Inside `report_row`, though, the only P0001 raise is the rate limit, and the other failures use other codes, so mapping P0001 to "rate limited" is correct for this function. The cost is that the mapping depends on that fact. A distinct error code would need a migration, which this issue avoids. The unit test for the mapping should pin this, so a later change that adds another P0001 raise to `report_row` is caught.

## Decisions already made

- Admins are Enzo and Stefan. They read reports on the admin page and get an email per new report: up to 10 emails an hour, then one summary email, then none until the hour passes.
- Screens are Enzo's, SQL and data are Stefan's. This issue touches only screens, strings, CSS, the privacy page and one README line.

## Decision 2 is answered by the code

Admins can already see the reporter's display name. `admin_list_reports` in migration 006 returns `reporter` (the reporter's display name, or "(no profile)"), and `AdminPage.tsx` renders it as "by {reporter}". The notify email carries no reporter and no user id.

Still open for Stefan: whether the SQL should change so admins do not see the reporter's name. If he says yes, that is a change to `admin_list_reports` (a migration) and to `AdminPage.tsx`, which is outside this plan. Either way, the privacy text ships with the Report button and must say the two admins can see the reporter's display name.

## Design

1. **Button.** Shown on every row except the viewer's own (`row.isMe`), whether or not the viewer has joined. It opens the dialog.
2. **Dialog.** New file `src/components/ReportDialog.tsx`, so `LeaderboardScreen.tsx` does not grow. It reuses `useModalFocus`. It has a text field for the reason, limited to 300 characters, with a counter. Send is disabled until the trimmed reason has at least one character. Free text replaces the old three options because the database stores free text, and admins read the reasons by hand. The dialog must not say that a row can be reported only once: migration 006 allows a new report after an earlier one is resolved.
3. **Client.** `reportRow(client, rowKey, reason)` in `leaderboardApi.ts` calls `client.rpc("report_row", { row_key: rowKey, reason })`. It throws a `LeaderboardError` with a new code for signed out (42501 and 28000), a new code for the rate limit (P0001), and `failed` for anything else. `LeaderboardErrorCode` gains the two new values.
4. **Signed out.** The client session check and the error mapping above. The dialog shows the sign-in message with a Close button and does not start the sign-in flow.
5. **Feedback.** On success the dialog closes and a toast says thanks. Restore the `onMessage` prop and pass `showToast` from `App.tsx`. The toast can appear even when nothing was saved: a duplicate open report and an ignored row both succeed silently in the database, and the app does not tell the player which happened. This is deliberate. The toast must not promise a specific review, so do not reuse the old English wording "We'll take a look."
6. **Privacy text.** Restore the removed sentence, updated to match the admin page: any signed-in player can report a row, the two people who run the app read the reports, the admins see the reporter's display name, and a reported row may be hidden from the board.
7. **Supabase README.** Replace the line saying no app UI writes reports yet, and change "Run 005" to name both 005 and 006.

## Strings

English and Spanish keys in `src/i18n/en.ts` and `es.ts`: the removed `leaderboard.report*` keys, restored and reworded where the facts changed, plus the reason label, the counter, the sign-in message, the rate-limit message and the generic failure.

The removed Spanish UI used "Denunciar" (for example `reportTitle` "Denunciar a {name}" and `reportSend` "Enviar denuncia"). "Reportar" reverses that earlier choice. Decision 1 below stays Stefan's.

## Tests

- New `src/components/ReportDialog.test.tsx` (jsdom and Testing Library, like `LeaderboardScreen.test.tsx`): Send is disabled for an empty or blank reason; the 300-character limit; a successful send calls `reportRow` with the row key and closes the dialog; the sign-in and rate-limit messages each show their own text; Escape closes the dialog.
- `src/lib/leaderboardApi.test.ts`: a test for the `reportRow` error mapping, with a mocked Supabase client as the other tests in that file use. It covers 42501 and 28000 (signed out), P0001 (rate limit), and an unknown code (`failed`).
- `LeaderboardScreen.test.tsx`: pass the new `onMessage` prop, and add a test that the viewer's own row has no Report button.
- The rate limit is covered by unit tests only. Do not test it on the live project: reaching it takes 10 reports from one account, which would email the admins 10 times and use up that account's quota for a day.

## Files that change

`ReportDialog.tsx` and its test (new), `LeaderboardScreen.tsx` and its test, `leaderboardApi.ts` and its test, `i18n/en.ts`, `i18n/es.ts`, `App.tsx`, `index.css`, `public/privacy.html`, `supabase/README.md`. Not changed: `supabase/migrations`, `supabase/tests`, `AdminPage.tsx` and `supabase/functions/notify-report`.

## Order of work

1. Before building, confirm that migration 006 is applied on the live project. This is a Stefan step in the SQL editor. It is read-only: check that `leaderboard_reports` has the `status` column and that `admin_list_reports` exists. Do not insert a report to check. The app must not ship before 006, because the new code relies on the 006 `report_row` (the one-open-report rule and the status column).
2. Rewrite the client call with the row-key signature and the error mapping. Then the dialog, strings, CSS, privacy and README text.
3. Dialog, screen and client tests. Then `npm test`, `tsc -b` (the repo's build runs `tsc -b`, so use that rather than `npx tsc --noEmit`) and `npm run lint`.
4. Open the PR. Merging deploys `main` automatically, so the merge is the deploy. After the merge, a throwaway account that belongs to neither Enzo nor Stefan files one report on the live app. The notify function emails the admins for that insert, which is expected. Then dismiss that test report in `/#admin`. This checks the end-to-end path. The rate limit and the sign-in message are covered by unit tests, not by this check.

Still to check while building: how `LeaderboardScreen` imports `loadSupabase` (so the test mock matches), and whether `useModalFocus` works for the new dialog without changes.

## Decisions for Stefan

1. Spanish wording for the button: "Reportar" (recommended) or "Denunciar". "Reportar" reverses the earlier Spanish "Denunciar".
2. Should admins stop seeing the reporter's display name? Today they see it (see "Decision 2 is answered by the code"). If yes, that is a SQL change plus an `AdminPage.tsx` change, and it is not part of this plan.

Relates to #96, #103, #104 and #109.
