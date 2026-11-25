import { useEffect, useRef, useState } from "react";
import type { LeaderboardProfile, LeaderboardRow, LeaderboardScope, Tree } from "../types";
import type { Auth } from "../auth/useAuth";
import { loadSupabase } from "../auth/client";
import { fetchLeaderboard, flagEmoji, LEADERBOARD_TREE, levelStepName, scopeAvailable, type LeaderboardResult } from "../lib/leaderboardApi";
import { formatNumber } from "../lib/progress";
import { language, t } from "../i18n";

const SCOPES: LeaderboardScope[] = ["global", "continent", "hemisphere", "country"];

interface Props {
  tree: Tree;
  auth: Auth;
  /** The player's leaderboard settings, or null if they haven't made any. */
  profile: LeaderboardProfile | null;
  profileLoading: boolean;
  /** Loading the profile failed; show a retry instead of the Join flow. */
  profileError: boolean;
  onRetryProfile: () => void;
  onBack: () => void;
  /** Opens the profile dialog to join or to add the missing place. */
  onEditProfile: () => void;
  onSignIn: () => void;
}

/** The ranked leaderboard: four scope tabs, an optional single-test filter, the top 50 and your own row. */
export function LeaderboardScreen({ tree, auth, profile, profileLoading, profileError, onRetryProfile, onBack, onEditProfile, onSignIn }: Props) {
  const [scope, setScope] = useState<LeaderboardScope>("global");
  const [sprintOnly, setSprintOnly] = useState(false);
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  const supported = tree.id === LEADERBOARD_TREE;
  const signedIn = auth.configured && Boolean(auth.account);
  const available = scopeAvailable(scope, profile);

  useEffect(() => {
    if (!signedIn || !supported || !available) {
      setResult(null);
      return;
    }
    let active = true;
    setResult(null);
    setFailed(false);
    loadSupabase()
      .then((client) => (client ? fetchLeaderboard(client, scope, tree.id, sprintOnly) : Promise.reject(new Error("no client"))))
      .then((r) => active && setResult(r))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [signedIn, supported, available, scope, tree.id, sprintOnly, reload, profile?.leaderboardOptIn]);

  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  function tabKey(e: React.KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = SCOPES[(index + step + SCOPES.length) % SCOPES.length];
    setScope(next);
    document.getElementById(`lb-tab-${next}`)?.focus();
  }

  return (
    <div className="screen leaderboard">
      <div className="screen-head">
        <h1 className="screen-title" ref={heading} tabIndex={-1}>
          {t.leaderboard.title}
        </h1>
        <button className="btn pill" type="button" onClick={onBack}>
          {t.leaderboard.back}
        </button>
      </div>

      {!auth.configured && <p className="card-note">{t.leaderboard.needAccounts}</p>}
      {auth.configured && !auth.loading && !auth.account && (
        <section className="card">
          <p className="card-note">{t.leaderboard.needSignIn}</p>
          <button className="btn primary" type="button" onClick={onSignIn}>
            {t.leaderboard.signIn}
          </button>
        </section>
      )}

      {signedIn && !profileLoading && profileError && (
        <section className="card">
          <p className="card-note" role="alert">{t.leaderboardProfile.loadFailed}</p>
          <button className="btn primary" type="button" onClick={onRetryProfile}>
            {t.leaderboardProfile.retry}
          </button>
        </section>
      )}

      {signedIn && !profileLoading && !profileError && !profile?.leaderboardOptIn && (
        <section className="card">
          <p className="card-note">{t.leaderboard.notJoined}</p>
          <button className="btn primary" type="button" onClick={onEditProfile}>
            {t.leaderboard.join}
          </button>
        </section>
      )}

      {signedIn && (
        <>
          <div className="lb-tabs" role="tablist" aria-label={t.leaderboard.scopeLabel}>
            {SCOPES.map((s, i) => (
              <button
                key={s}
                id={`lb-tab-${s}`}
                role="tab"
                type="button"
                aria-selected={scope === s}
                aria-controls="lb-panel"
                tabIndex={scope === s ? 0 : -1}
                className="lb-tab"
                onClick={() => setScope(s)}
                onKeyDown={(e) => tabKey(e, i)}
              >
                {t.leaderboard.scopes[s]}
              </button>
            ))}
          </div>

          <label className="lb-filter">
            <span>{t.leaderboard.testLabel}</span>
            <select value={sprintOnly ? "sprint" : ""} onChange={(e) => setSprintOnly(e.target.value === "sprint")}>
              <option value="">{t.leaderboard.overall}</option>
              <option value="sprint">{t.leaderboard.sprintTest}</option>
            </select>
          </label>
          <p className="card-note">{sprintOnly ? t.leaderboard.testNote : t.leaderboard.overallNote}</p>

          <div id="lb-panel" role="tabpanel" aria-labelledby={`lb-tab-${scope}`} aria-live="polite">
            {!supported && <p className="card-note">{t.leaderboard.empty}</p>}
            {supported && !available && (
              <section className="card">
                <p className="card-note">{t.leaderboard.needLocation[scope as Exclude<LeaderboardScope, "global">]}</p>
                <button className="btn" type="button" onClick={onEditProfile}>
                  {t.leaderboard.addLocation}
                </button>
              </section>
            )}
            {supported && available && failed && (
              <section className="card">
                <p className="card-note">{t.leaderboard.loadFailed}</p>
                <button className="btn" type="button" onClick={() => setReload((n) => n + 1)}>
                  {t.leaderboard.retry}
                </button>
              </section>
            )}
            {supported && available && !failed && !result && <p className="card-note">{t.leaderboard.loading}</p>}
            {result && result.top.length === 0 && <p className="card-note">{t.leaderboard.empty}</p>}
            {result && result.top.length > 0 && (
              <ol className="lb-list">
                {result.top.map((row) => (
                  <Row key={`${row.rank}-${row.displayName}`} row={row} tree={tree} sprintOnly={sprintOnly} />
                ))}
                {result.me && (
                  <>
                    <li className="lb-gap" aria-hidden="true">
                      …
                    </li>
                    <Row row={result.me} tree={tree} sprintOnly={sprintOnly} />
                  </>
                )}
              </ol>
            )}
          </div>
        </>
      )}

    </div>
  );
}

/** One player: rank, flag and name, and the score. Your own row is marked. */
function Row({ row, tree, sprintOnly }: { row: LeaderboardRow; tree: Tree; sprintOnly: boolean }) {
  const flag = flagEmoji(row.countryCode);
  const sprint = row.bestSprint !== null ? t.leaderboard.sprint(formatNumber(row.bestSprint, language)) : null;
  const score = sprintOnly
    ? sprint
    : [levelStepName(tree, row.levelStep), t.leaderboard.skillsCount(row.skills), sprint]
        .filter(Boolean)
        .join(" · ");
  return (
    <li className={`lb-row${row.isMe ? " me" : ""}`} aria-current={row.isMe ? "true" : undefined}>
      <span className="lb-rank">{row.rank}</span>
      <span className="lb-name">
        {flag && <span aria-hidden="true">{flag} </span>}
        {row.displayName}
        {row.isMe && <em className="lb-you"> {t.leaderboard.you}</em>}
      </span>
      <span className="lb-score">{score}</span>
    </li>
  );
}
