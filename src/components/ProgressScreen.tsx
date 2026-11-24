import type { Tree } from "../types";
import { RankProgress } from "./Header";
import { PRACTICE_DAYS_PER_WEEK } from "../lib/streak";
import { t } from "../i18n";

interface Props {
  tree: Tree;
  doneCount: number;
  /** The player's level and step, e.g. "Beginner 2", or null if they haven't picked one. */
  playerLevelName: string | null;
  daysThisWeek: number;
  streakWeeks: number;
  onShare: () => void;
}

/** Rank, training this week and the share picture. The full Progress tab (personal bests, history) is step 6 of #19. */
export function ProgressScreen({ tree, doneCount, playerLevelName, daysThisWeek, streakWeeks, onShare }: Props) {
  return (
    <div className="screen">
      <h1 className="screen-title">{t.tabs.progress}</h1>

      <section className="card" aria-label={t.progressScreen.rankLabel}>
        <RankProgress tree={tree} doneCount={doneCount} />
      </section>

      {playerLevelName && (
        <section className="card stats" aria-label={t.practice.label}>
          <div className="stat">
            <span className="stat-label">{t.progressScreen.level}</span>
            <span className="stat-value">{playerLevelName}</span>
          </div>
          <div className="stat">
            <span className="stat-label">{t.progressScreen.thisWeek}</span>
            <span className="stat-value">{t.practice.days(daysThisWeek, PRACTICE_DAYS_PER_WEEK)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">{t.progressScreen.streak}</span>
            <span className="stat-value">{t.practice.weeks(streakWeeks)}</span>
          </div>
        </section>
      )}

      <button className="btn primary wide" type="button" onClick={onShare}>
        {t.header.share}
      </button>
    </div>
  );
}
