import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { flagEmoji } from "../lib/leaderboardApi";
import { fetchReports, resolveReport, unhidePlayer, type ReportList, type ReportedPlayer } from "./adminApi";
import "./admin.css";

interface Props {
  client: SupabaseClient;
}

/** The admin page: reported players, newest first, with Hide, Dismiss and Unhide. English only. */
export function AdminPage({ client }: Props) {
  const [which, setWhich] = useState<ReportList>("open");
  const [players, setPlayers] = useState<ReportedPlayer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPlayers(await fetchReports(client, which));
    } catch (e) {
      setPlayers(null);
      setError(e instanceof Error ? e.message : "Could not load the reports.");
    }
  }, [client, which]);

  useEffect(() => {
    setPlayers(null);
    setConfirming(null);
    void load();
  }, [load]);

  async function act(run: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await run();
      setConfirming(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin">
      <h1>Leaderboard reports</h1>
      <div className="admin-tabs" role="tablist" aria-label="Reports">
        {(["open", "resolved"] as const).map((w) => (
          <button key={w} type="button" role="tab" aria-selected={which === w} className={`btn${which === w ? " primary" : ""}`} onClick={() => setWhich(w)}>
            {w === "open" ? "Open" : "Resolved"}
          </button>
        ))}
        <a className="btn" href="/">
          Back to the app
        </a>
      </div>

      {error && (
        <p className="admin-error" role="alert">
          {error}{" "}
          <button className="btn" type="button" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {!error && players === null && <p>Loading…</p>}
      {players?.length === 0 && <p>{which === "open" ? "No open reports." : "No resolved reports yet."}</p>}

      <ul className="admin-list">
        {players?.map((p) => {
          const key = p.rowKey ?? `${p.displayName}-${p.lastReportedAt}`;
          return (
            <li key={key} className="admin-player">
              <h2>
                {flagEmoji(p.countryCode)} {p.displayName}
                {p.hidden && <span className="admin-badge"> Hidden</span>}
              </h2>
              <p className="admin-meta">
                {p.openCount} open · last report {new Date(p.lastReportedAt).toLocaleString()}
              </p>
              <ul className="admin-reports">
                {p.reports.map((r) => (
                  <li key={r.id}>
                    <p>“{r.reason}”</p>
                    <p className="admin-meta">
                      by {r.reporter} · {new Date(r.reportedAt).toLocaleString()}
                      {r.status !== "open" && ` · ${r.status}`}
                    </p>
                    {r.status === "open" && (
                      <button className="btn" type="button" disabled={busy} onClick={() => void act(() => resolveReport(client, r.id, "dismiss"))}>
                        Dismiss
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              <div className="admin-actions">
                {!p.hidden && p.openCount > 0 && confirming !== key && (
                  <button className="btn danger" type="button" disabled={busy} onClick={() => setConfirming(key)}>
                    Hide row
                  </button>
                )}
                {confirming === key && (
                  <>
                    <span>Hide {p.displayName} from the leaderboard?</span>
                    <button
                      className="btn danger"
                      type="button"
                      disabled={busy}
                      onClick={() => void act(() => resolveReport(client, p.reports.find((r) => r.status === "open")!.id, "hide"))}
                    >
                      Yes, hide
                    </button>
                    <button className="btn" type="button" disabled={busy} onClick={() => setConfirming(null)}>
                      Cancel
                    </button>
                  </>
                )}
                {p.hidden && p.rowKey && (
                  <button className="btn" type="button" disabled={busy} onClick={() => void act(() => unhidePlayer(client, p.rowKey!))}>
                    Unhide
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
