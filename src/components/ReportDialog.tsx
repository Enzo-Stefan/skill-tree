import { useEffect, useId, useRef, useState } from "react";
import type { LeaderboardRow } from "../types";
import { loadSupabase } from "../auth/client";
import { LeaderboardError, reportRow } from "../lib/leaderboardApi";
import { t } from "../i18n";
import { useModalFocus } from "./useModalFocus";

/** The longest reason the database keeps (migration 006 cuts anything longer). */
export const REASON_MAX = 300;

interface Props {
  row: LeaderboardRow;
  onClose: () => void;
  /** Called after the report is saved. The parent closes the dialog and shows the thanks toast. */
  onSent: () => void;
}

/** Asks for a free-text reason and sends it with the row key. Escape and Cancel close it, except while sending. */
export function ReportDialog({ row, onClose, onSent }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);
  const countId = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  useModalFocus(dialog, busy ? () => {} : onClose);
  // Declared after useModalFocus, so this runs after the hook's own focus and the textarea wins.
  useEffect(() => field.current?.focus(), []);
  // The textarea is disabled while sending, so focus can only land in it after the render that shows the error.
  useEffect(() => {
    if (error) field.current?.focus();
  }, [error]);

  const trimmed = reason.trim();
  const canSend = trimmed.length > 0 && !busy && !signedOut;

  async function send() {
    if (!canSend || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const client = await loadSupabase();
      if (!client) throw new Error("no client");
      const { data } = await client.auth.getSession();
      if (!data.session) {
        setSignedOut(true);
        setError(t.leaderboard.reportSignIn);
        return;
      }
      await reportRow(client, row.rowKey, trimmed);
      onSent();
    } catch (e) {
      if (e instanceof LeaderboardError && e.code === "signedOut") {
        setSignedOut(true);
        setError(t.leaderboard.reportSignIn);
      } else if (e instanceof LeaderboardError && e.code === "rateLimited") {
        setError(t.leaderboard.reportTooMany);
      } else {
        setError(t.leaderboard.reportFailed);
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={busy ? undefined : onClose}>
      <div ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-labelledby="lb-report-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="lb-report-title">{t.leaderboard.reportTitle(row.displayName)}</h2>
        <p>{t.leaderboard.reportBody}</p>
        <label className="field">
          <span>{t.leaderboard.reportReason}</span>
          <textarea
            ref={field}
            rows={4}
            value={reason}
            maxLength={REASON_MAX}
            disabled={busy}
            aria-describedby={countId}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
          />
          <small id={countId}>{t.leaderboard.reportCount(reason.length, REASON_MAX)}</small>
        </label>
        {error && (
          <p className="card-note" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button className="btn" type="button" onClick={onClose} disabled={busy}>
            {signedOut ? t.leaderboard.close : t.leaderboard.cancel}
          </button>
          <button className="btn primary" type="button" onClick={() => void send()} disabled={!canSend}>
            {t.leaderboard.reportSend}
          </button>
        </div>
      </div>
    </div>
  );
}
