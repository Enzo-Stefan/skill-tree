import type { CSSProperties } from "react";
import type { Tree } from "../types";
import { MAX_RATING, type Ratings } from "../lib/ratings";
import type { RatingSnapshot } from "../lib/ratingHistory";
import { t } from "../i18n";
import { CHART_H, CHART_W, historyPoints } from "./playerCardChart";

interface Props {
  tree: Tree;
  ratings: Ratings;
  /** One snapshot per week, oldest first. */
  history: RatingSnapshot[];
  /** True once the player has passed a skill. Until then the card shows a prompt instead of zeros. */
  hasProgress: boolean;
}

/**
 * The player card (#123): the overall rating, one rating per branch, and how the overall changed week by week.
 * Ratings are worked out on this device from progress.
 */
export function PlayerCard({ tree, ratings, history, hasProgress }: Props) {
  const points = historyPoints(history);
  const first = history[0]?.overall;
  const last = history[history.length - 1]?.overall;
  const outOf = ` ${t.playerCard.outOf(MAX_RATING)}`;
  return (
    <section className="card player-card" aria-labelledby="player-card-title">
      <div className="card-row">
        <h2 className="card-label" id="player-card-title">
          {t.playerCard.title}
        </h2>
        {hasProgress && <span className="card-aside">{t.playerCard.weeks(history.length)}</span>}
      </div>
      {!hasProgress ? (
        <p className="card-note">{t.playerCard.empty}</p>
      ) : (
        <>
          <div className="player-overall">
            <span className="card-big">{ratings.overall}</span>
            <span className="sr-only">{outOf}</span>
            <span className="card-note">{t.playerCard.overall}</span>
          </div>
          <ul className="player-ratings">
            {tree.branches.map((b) => {
              const value = ratings.branches[b.id] ?? 0;
              return (
                <li key={b.id}>
                  <span className="player-ratings-name">{b.name}</span>
                  <span className="player-ratings-bar" aria-hidden="true">
                    <span style={{ width: `${value}%`, background: b.color } as CSSProperties} />
                  </span>
                  <strong>
                    {value}
                    <span className="sr-only">{outOf}</span>
                  </strong>
                </li>
              );
            })}
          </ul>
          {points && first !== undefined && last !== undefined && (
            <div className="player-history">
              <span className="player-history-value" aria-hidden="true">
                {first}
              </span>
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={t.playerCard.historyLabel(first, last, history.length - 1)} preserveAspectRatio="none">
                <polyline points={points} fill="none" stroke="var(--fg)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <span className="player-history-value" aria-hidden="true">
                {last}
              </span>
              <ul className="sr-only">
                {history.map((s) => (
                  <li key={s.week}>{t.playerCard.weekRow(s.week, s.overall)}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="card-note">{t.playerCard.how}</p>
        </>
      )}
    </section>
  );
}
