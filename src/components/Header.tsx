import type { ReactNode } from "react";
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
  /** The switch between trees (Football / Strength), shown above the title. */
  treeSwitch?: ReactNode;
}

/** Top of the Train tab: which tree, your rank, and your level (the targets depend on it). */
export function Header({ tree, doneCount, playerLevelName, onChangeLevel, treeSwitch }: Props) {
  const total = tree.skills.length;
  const { current, next } = levelInfo(tree.levels, doneCount);
  const leveledUp = useIncreased(tree.levels.indexOf(current));

  return (
    <header className="header">
      <div className="brand">
        {treeSwitch}
        <h1>{tree.title}</h1>
        <p>{tree.tagline}</p>
      </div>
      <div className="progress">
        <div className="progress-top">
          <span className={`level${leveledUp ? " bump" : ""}`}>{current.name}</span>
          <span className="count">
            {t.header.skillsCount(doneCount, total)}
          </span>
        </div>
        <div className="bar">
          <span style={{ width: `${(doneCount / total) * 100}%` }} />
        </div>
        <span className="next-level">
          {next ? t.header.moreToReach(next.at - doneCount, next.name) : t.header.allUnlocked}
        </span>
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
