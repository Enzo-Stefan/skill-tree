import { useId, useRef, type CSSProperties, type KeyboardEvent } from "react";
import type { Tree } from "../types";
import { MAX_RATING, type Ratings } from "../lib/ratings";
import type { RatingSnapshot } from "../lib/ratingHistory";
import { FEET, POSITIONS, type PlayerCard as Card } from "../lib/ratingHistory";
import { t } from "../i18n";
import { CHART_H, CHART_W, historyPoints } from "./playerCardChart";

interface Props {
  tree: Tree;
  ratings: Ratings;
  /** One snapshot per week, oldest first. */
  history: RatingSnapshot[];
  /** True once the player has passed a skill. Until then the card shows a prompt instead of zeros. */
  hasProgress: boolean;
  /** Position and preferred foot. Left out, the pickers are not shown. */
  card?: Card;
  onCardChange?: (next: Card) => void;
  /** Opens the share picture of the card. Left out, there is no button. */
  onShareCard?: () => void;
}

/**
 * One optional choice, as a radio group: the chosen button (or the first when none is chosen) is the only tab stop,
 * and arrow keys move to the next or previous button and choose it. A "Clear" button empties the choice.
 */
function Pick<T extends string>({ label, options, names, value, onPick }: { label: string; options: readonly T[]; names: Record<T, string>; value: T | null; onPick: (next: T | null) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = useId();
  const stop = value === null ? 0 : options.indexOf(value);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step !== 0) {
      e.preventDefault();
      const to = (index + step + options.length) % options.length;
      onPick(options[to]);
      buttons.current[to]?.focus();
    }
  };

  return (
    <div className="player-pick" role="radiogroup" aria-labelledby={labelId}>
      <span className="player-pick-label" id={labelId}>
        {label}
      </span>
      {options.map((o, i) => (
        <button
          key={o}
          ref={(el) => {
            buttons.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === o}
          tabIndex={i === stop ? 0 : -1}
          className={value === o ? "btn on" : "btn"}
          onClick={() => onPick(o)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {names[o]}
        </button>
      ))}
      {value !== null && (
        <button type="button" className="btn player-pick-clear" aria-label={`${t.playerCard.clear} ${label}`} onClick={() => onPick(null)}>
          {t.playerCard.clear}
        </button>
      )}
    </div>
  );
}

/**
 * The player card (#123): the overall rating, one rating per branch, and how the overall changed week by week.
 * Ratings are worked out on this device from progress.
 */
export function PlayerCard({ tree, ratings, history, hasProgress, card, onCardChange, onShareCard }: Props) {
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
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={t.playerCard.historyLabel(first, last, t.playerCard.weeks(history.length))} preserveAspectRatio="none">
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
          {onShareCard && (
            <button className="btn player-share" type="button" onClick={onShareCard}>
              {t.playerCard.share}
            </button>
          )}
        </>
      )}

      {card && onCardChange && (
        <div className="player-picks">
          <Pick label={t.playerCard.position} options={POSITIONS} names={t.playerCard.positions} value={card.position} onPick={(position) => onCardChange({ ...card, position })} />
          <Pick label={t.playerCard.foot} options={FEET} names={t.playerCard.feet} value={card.foot} onPick={(foot) => onCardChange({ ...card, foot })} />
          <p className="card-note">{t.playerCard.private}</p>
        </div>
      )}
    </section>
  );
}
