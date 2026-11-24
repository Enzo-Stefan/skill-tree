import type { CSSProperties } from "react";
import type { Tree } from "../types";
import { RankProgress } from "./Header";
import { PRACTICE_DAYS_PER_WEEK, STREAK_WEEKS, type DayKey } from "../lib/streak";
import { STEPS_PER_LEVEL } from "../lib/progress";
import { t } from "../i18n";
import type { LiftEntry } from "../lib/lifts";
import { PersonalBests } from "./PersonalBests";
import { WeekDots } from "./WeekDots";

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
}

/** Rank, your level and streak, training this week, each branch, personal bests on lifts, and the share picture. */
export function ProgressScreen(props: Props) {
  const { tree, done, playerLevelName, playerStep, levelTestAhead, practiceDays, today, daysThisWeek, weekCanCount, streakWeeks, liftLog, onShare, onPickLevel } = props;
  const daysLeft = Math.max(0, PRACTICE_DAYS_PER_WEEK - daysThisWeek);

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
            <h2 className="card-label" id="progress-level">
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
