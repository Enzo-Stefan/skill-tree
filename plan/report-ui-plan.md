# Report button and dialog (plan for #104)

Status: proposal, for Stefan's yes. Nothing here is built.

## Goal

A signed-in player can report another player's row on the leaderboard. The report goes to `leaderboard_reports`, where the admin page (#109) will show it. Without this button there are no reports to show.

## What exists

- Database: `report_row(row_key uuid, reason text)` and `leaderboard_reports` are in migration 005 and applied on the live project. This issue needs no migration and no SQL change.
- Row key: `leaderboard()` returns a random `rowKey` for each row (`LeaderboardRow.rowKey` in `src/types.ts`). The app never sees user ids.
- The old UI was removed in commit `f94b3ce`, so its parent `f94b3ce^` has the screen code to restore. Commit `2cba5fd`, which #104 names, only adds tests, so it is not the source.
- The old client call is out of date. It calls `report_row` with `reported_name` (the display name) and a three-option reason. Migration 005 takes `row_key` and a free-text reason (1 to 300 characters; blank is stored as "unspecified"). The client must be rewritten, not copied.
- Global scope needs no profile (`scopeAvailable` in `src/lib/leaderboardApi.ts`), so a signed-in player who never joined still sees the board and can report. The board is not fetched while signed out.
- The database rejects a report with "Sign in to report a row." or "Too many reports today." (10 per 24 hours). The app handles neither yet. Both reach the client as error code `failed`, so the app has to match on the message text. That is fragile, but a proper error code would need a migration, which this issue avoids.
- `f94b3ce` also removed the `onMessage` prop from the screen (`App.tsx` passed `showToast`), the privacy sentence about reports, and changed a line in `supabase/README.md` to say no app UI writes reports yet.

## Decisions already made

- Admins are Enzo and Stefan. They read reports on the admin page (#109) and get an email per report.
- This task comes first, because the admin page and emails have nothing to show without the button.
- Screens are Enzo's, SQL and data are Stefan's. This issue touches only screens, strings, CSS, the privacy page and one README line.

## Design

1. **Button.** Shown on every row except the viewer's own (`row.isMe`), whether or not the viewer has joined. It opens the dialog.
2. **Dialog.** New file `src/components/ReportDialog.tsx`, so `LeaderboardScreen.tsx` does not grow. It reuses `useModalFocus`. It has a text field for the reason, limited to 300 characters, with a counter. Send is disabled until the trimmed reason has at least one character. Free text replaces the old three options because the database stores free text, and admins read the reasons by hand.
3. **Client.** `reportRow(client, rowKey, reason)` in `leaderboardApi.ts` calls `client.rpc("report_row", { row_key: rowKey, reason })` and throws a `LeaderboardError` with the database message. The dialog shows its own text for the two known messages and a generic failure otherwise.
4. **Signed out.** Rows only appear when signed in, so this only happens if the session expires while the dialog is open. The dialog shows the sign-in message with a Close button and does not start the sign-in flow.
5. **Feedback.** On success the dialog closes and a toast says thanks. Restore the `onMessage` prop and pass `showToast` from `App.tsx`.
6. **Privacy text.** Restore the removed sentence, updated to match #109: any signed-in player can report a row, the two of us who run the app read the reports, and a reported row may be hidden. Mention the reporter's display name only if Decision 2 below is yes.
7. **Supabase README.** Replace the line saying no app UI writes reports yet.

## Strings

English and Spanish keys in `src/i18n/en.ts` and `es.ts`: the removed `leaderboard.report*` keys, plus the reason label, the counter, the two database messages and the generic failure.

## Tests

- New `src/components/ReportDialog.test.tsx` (jsdom and Testing Library, like `LeaderboardScreen.test.tsx`): Send is disabled for an empty or blank reason; the 300-character limit; a successful send calls `reportRow` with the row key and closes the dialog; each database message shows its own text; Escape closes the dialog.
- `LeaderboardScreen.test.tsx`: pass the new `onMessage` prop, and add a test that the viewer's own row has no Report button.

## Files that change

`ReportDialog.tsx` and its test (new), `LeaderboardScreen.tsx` and its test, `leaderboardApi.ts`, `i18n/en.ts`, `i18n/es.ts`, `App.tsx`, `index.css`, `public/privacy.html`, `supabase/README.md`. Not changed: `supabase/migrations` and `supabase/tests`.

## Order of work

1. Restore the button, dialog and client call with the row-key signature.
2. Strings, CSS, privacy and README text.
3. Dialog and screen tests, then `npm test`, `npx tsc --noEmit` and lint.
4. Report once from a test account on the live project to confirm the two database messages, then merge. Merging deploys `main` automatically, so this check comes first.

Still to check while building: how `LeaderboardScreen` imports `loadSupabase` (so the test mock matches), and whether `useModalFocus` works for the new dialog without changes.

## Decisions for Stefan

1. Spanish wording for the button: "Reportar" (recommended) or "Denunciar".
2. Show the reporter's display name to admins on the admin page (#109)? This decides whether the privacy text mentions it.

Relates to #96, #103, #104 and #109.
