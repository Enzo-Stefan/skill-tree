import type { CSSProperties } from "react";
import type { Tree } from "../types";
import type { Ratings } from "../lib/ratings";
import type { RatingSnapshot } from "../lib/ratingHistory";
import { t } from "../i18n";
import { CHART_H, CHART_W, historyPoints } from "./playerCardChart";

interface Props {
  tree: Tree;
  ratings: Ratings;
  /** One snapshot per week, oldest first. */
  history: RatingSnapshot[];
}

/**
 * The player card (#123): the overall rating, one rating per branch, and how the overall changed week by week.
 * Ratings are worked out on this device from progress. Until the first skill is passed it shows a prompt, not zeros.
 */
export function PlayerCard({ tree, ratings, history }: Props) {
  const empty = ratings.overall === 0;
  const points = historyPoints(history);
  return (
    <section className="card player-card" aria-labelledby="player-card-title">
      <div className="card-row">
        <h2 className="card-label" id="player-card-title">
          {t.playerCard.title}
        </h2>
        {!empty && <span className="card-aside">{t.playerCard.weeks(history.length)}</span>}
      </div>
      {empty ? (
        <p className="card-note">{t.playerCard.empty}</p>
      ) : (
        <>
          <div className="player-overall" aria-label={t.playerCard.overallLabel(ratings.overall)}>
            <span className="card-big">{ratings.overall}</span>
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
                  <strong aria-label={t.playerCard.branchLabel(b.name, value)}>{value}</strong>
                </li>
              );
            })}
          </ul>
          {points && (
            <svg className="player-history" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={t.playerCard.historyLabel(history.length)} preserveAspectRatio="none">
              <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          <p className="card-note">{t.playerCard.how}</p>
        </>
      )}
    </section>
  );
}
