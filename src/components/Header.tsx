import type { Tree } from "../types";
import { levelInfo } from "../lib/progress";
import { useIncreased } from "./useIncreased";
import { t } from "../i18n";

interface Props {
  tree: Tree;
  doneCount: number;
  /** The player's level and step, e.g. "Beginner 2", or null. Leave undefined for trees without levels. */
  playerLevelName?: string | null;
  onChangeLevel?: () => void;
}

/** Top of the Train tab: which tree, your rank, and your level (the targets depend on it). */
export function Header({ tree, doneCount, playerLevelName, onChangeLevel }: Props) {
  return (
    <header className="header">
      <div className="brand">
        <h1>{t.app.train}</h1>
        {/* Google checks that the home screen links to the privacy policy before it approves sign-in. */}
        <p>
          {tree.tagline} <a className="privacy-link" href="/privacy.html">{t.header.privacy}</a>
        </p>
      </div>
      <div className="progress">
        <RankProgress tree={tree} doneCount={doneCount} />
      </div>
      {onChangeLevel && (
        <div className="actions">
          <button className="btn" type="button" onClick={onChangeLevel}>
            {t.header.level(playerLevelName ?? null)}
          </button>
        </div>
      )}
    </header>
  );
}

/** Rank, skill count, progress bar and how many skills to the next rank. Used on Train and Progress. */
export function RankProgress({ tree, doneCount }: { tree: Tree; doneCount: number }) {
  const total = tree.skills.length;
  const { current, next } = levelInfo(tree.levels, doneCount);
  const leveledUp = useIncreased(tree.levels.indexOf(current));
  return (
    <>
      <div className="progress-top">
        <span className={`level${leveledUp ? " bump" : ""}`}>{current.name}</span>
        <span className="count">{t.header.skillsCount(doneCount, total)}</span>
      </div>
      <div className="bar">
        <span style={{ width: `${(doneCount / total) * 100}%` }} />
      </div>
      <span className="next-level">
        {next ? t.header.moreToReach(next.at - doneCount, next.name) : t.header.allUnlocked}
      </span>
    </>
  );
}
