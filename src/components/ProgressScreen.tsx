import { useEffect, useRef, type CSSProperties } from "react";
import type { Tree } from "../types";
import { RankProgress } from "./Header";
import type { XpState } from "../lib/useXp";
import { ACHIEVEMENTS } from "../data/achievements";
import { PRACTICE_DAYS_PER_WEEK, STREAK_WEEKS, type DayKey } from "../lib/streak";
import { STEPS_PER_LEVEL } from "../lib/progress";
import { t } from "../i18n";
import type { LiftEntry } from "../lib/lifts";
import { PersonalBests } from "./PersonalBests";
import { WeekDots } from "./WeekDots";
import { PlayerCard } from "./PlayerCard";
import type { Ratings } from "../lib/ratings";
import type { PlayerCard as Card, RatingSnapshot } from "../lib/ratingHistory";

interface Props {
  tree: Tree;
  done: Set<string>;
  /** The player's level and step, e.g. "Beginner 2", or null if they haven't picked one. */
  playerLevelName: string | null;
  /** The step inside the level, 1 to 4. */
  playerStep: number;
  /** False at the very top step, where there's no level test left to train toward. */
  levelTestAhead: boolean;
  practiceDays: DayKey[];
  today: DayKey;
  daysThisWeek: number;
  /** False in the week the player changed step: that week can't count toward the streak. */
  weekCanCount: boolean;
  streakWeeks: number;
  /** The tree's lift log, for the personal bests. */
  liftLog: LiftEntry[];
  onShare: () => void;
  /** Opens the level picker; only for trees that have levels. */
  onPickLevel?: () => void;
  /** Opens the leaderboard; leave undefined for trees that don't have one. */
  onOpenLeaderboard?: () => void;
  /** Form XP and level (#121). Left out, the card is not shown. */
  xp?: XpState;
  /** Branch ratings and weekly history (#123). Left out, the player card is not shown. */
  ratings?: Ratings;
  ratingHistory?: RatingSnapshot[];
  /** True once the player has passed a skill. The player card shows its prompt until then. */
  hasProgress: boolean;
  /** Position and preferred foot, and how to change them. */
  card?: Card;
  onCardChange?: (next: Card) => void;
  /** Opens the share picture of the player card. */
  onShareCard?: () => void;
}

/** Rank, your level and streak, training this week, each branch, personal bests on lifts, and the share picture. */
export function ProgressScreen(props: Props) {
  const { tree, done, playerLevelName, playerStep, levelTestAhead, practiceDays, today, daysThisWeek, weekCanCount, streakWeeks, liftLog, onShare, onPickLevel, onOpenLeaderboard, xp, ratings, ratingHistory, hasProgress, card, onCardChange, onShareCard } = props;
  const daysLeft = Math.max(0, PRACTICE_DAYS_PER_WEEK - daysThisWeek);

  // Picking a level here removes the Pick your level button, so the picker can't hand focus back
  // to it. When focus was lost that way, put it on the level card's heading instead.
  const levelHeading = useRef<HTMLHeadingElement>(null);
  const hadLevel = useRef(playerLevelName !== null);
  useEffect(() => {
    const had = hadLevel.current;
    hadLevel.current = playerLevelName !== null;
    const focusLost = !document.activeElement || document.activeElement === document.body;
    if (!had && playerLevelName && focusLost) levelHeading.current?.focus();
  }, [playerLevelName]);

  return (
    <div className="screen">
      <div className="screen-head">
        <h1 className="screen-title">{t.tabs.progress}</h1>
        <button className="btn primary pill" type="button" onClick={onShare}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v13" />
            <path d="m7 8 5-5 5 5" />
            <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
          </svg>
          {t.header.share}
        </button>
      </div>

      <section className="card" aria-labelledby="progress-rank">
        <h2 className="card-label" id="progress-rank">
          {t.progressScreen.rankLabel}
        </h2>
        <RankProgress tree={tree} doneCount={done.size} />
      </section>

      {xp && (
        <section className="card" aria-labelledby="progress-form">
          <div className="card-row">
            <h2 className="card-label" id="progress-form">
              {t.xp.form}
            </h2>
            <strong className="card-aside strong">{t.xp.total(xp.total)}</strong>
          </div>
          <span className="card-big">{t.xp.level(xp.level.level)}</span>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={xp.level.span} aria-valuenow={xp.level.into} aria-label={t.xp.level(xp.level.level)}>
            <span style={{ width: `${xp.level.progress * 100}%` }} />
          </div>
          <p className="card-note">{t.xp.toNext(xp.level.span - xp.level.into)}</p>
          {/* Without ratings the player card (and its trophy summary) is not shown, so this line is the only count. */}
          {!ratings && <p className="card-note">{t.xp.trophies(xp.earned.filter((id) => ACHIEVEMENTS.some((a) => a.id === id)).length, ACHIEVEMENTS.length)}</p>}
        </section>
      )}

      {ratings && <PlayerCard tree={tree} ratings={ratings} history={ratingHistory ?? []} hasProgress={hasProgress} card={card} onCardChange={onCardChange} onShareCard={onShareCard} earned={xp?.earned} />}

      {onOpenLeaderboard && (
        <section className="card" aria-labelledby="progress-board">
          <h2 className="card-label" id="progress-board">
            {t.leaderboard.title}
          </h2>
          <p className="card-note">{t.leaderboard.cardNote}</p>
          <button className="btn" type="button" onClick={onOpenLeaderboard}>
            {t.leaderboard.open}
          </button>
        </section>
      )}

      {!playerLevelName && onPickLevel && (
        <section className="card" aria-labelledby="progress-level">
          <h2 className="card-label" id="progress-level">
            {t.progressScreen.yourLevel}
          </h2>
          <p className="card-note">{t.progressScreen.noLevel}</p>
          <button className="btn" type="button" onClick={onPickLevel}>
            {t.progressScreen.pickLevel}
          </button>
        </section>
      )}

      {playerLevelName && (
        <section className="card" aria-labelledby="progress-level">
          <div className="card-row">
            <h2 className="card-label" id="progress-level" ref={levelHeading} tabIndex={-1}>
              {t.progressScreen.yourLevel}
            </h2>
            <span className="card-aside">{t.progressScreen.step(playerStep, STEPS_PER_LEVEL)}</span>
          </div>
          <span className="card-big">{playerLevelName}</span>
          <div className="step-bars" aria-hidden="true">
            {Array.from({ length: STEPS_PER_LEVEL }, (_, i) => (
              <span key={i} className={i < playerStep ? "on" : undefined} />
            ))}
          </div>
          <p className="card-note">
            {t.progressScreen.streak}:{" "}
            <strong>
              {levelTestAhead ? t.progressScreen.weeksOf(Math.min(streakWeeks, STREAK_WEEKS), STREAK_WEEKS) : t.practice.weeks(streakWeeks)}
            </strong>
            {levelTestAhead && ` ${t.progressScreen.towardTest}`}
          </p>
        </section>
      )}

      {/* Everyone gets this week and the streak; with a level, the streak also shows in the level card. */}
      <section className="card" aria-labelledby="progress-week">
          <div className="card-row">
            <h2 className="card-label" id="progress-week">
              {t.progressScreen.thisWeek}
            </h2>
            <strong className="card-aside strong">{t.progressScreen.daysOf(daysThisWeek, PRACTICE_DAYS_PER_WEEK)}</strong>
          </div>
          <WeekDots days={practiceDays} today={today} />
          <p className="card-note">{!weekCanCount
              ? t.progressScreen.weekAfterMove
              : daysLeft > 0
                ? t.progressScreen.daysLeft(daysLeft)
                : t.progressScreen.weekCounts}</p>
          {!playerLevelName && (
            <p className="card-note">
              {t.progressScreen.streak}: <strong>{t.practice.weeks(streakWeeks)}</strong>
            </p>
          )}
        </section>

      <section className="card" aria-labelledby="progress-branches">
        <h2 className="card-label" id="progress-branches">
          {t.progressScreen.branches}
        </h2>
        <ul className="branch-bars">
          {tree.branches.map((b) => {
            const skills = tree.skills.filter((s) => s.branch === b.id);
            const count = skills.filter((s) => done.has(s.id)).length;
            return (
              <li key={b.id} className="branch-bar" style={{ "--c": b.color } as CSSProperties}>
                <span className="branch-bar-name">{b.name}</span>
                <span className="branch-bar-track" aria-hidden="true">
                  <span style={{ width: `${skills.length ? (count / skills.length) * 100 : 0}%` }} />
                </span>
                <span className="branch-bar-count">{t.progressScreen.branchCount(count, skills.length)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <PersonalBests tree={tree} log={liftLog} />
    </div>
  );
}
