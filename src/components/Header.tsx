import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Tree } from "../types";
import { levelInfo } from "../lib/progress";
import { useIncreased } from "./useIncreased";
import { t } from "../i18n";

interface Props {
  tree: Tree;
  doneCount: number;
  onCopy: () => void;
  onShare: () => void;
  onReset: () => void;
  /** The player's level and step, e.g. "Beginner 2", or null. Leave undefined for trees without levels. */
  playerLevelName?: string | null;
  onChangeLevel?: () => void;
  /** Sign in button or the signed-in account, shown first in the actions. */
  account?: ReactNode;
  /** The switch between trees (Football / Strength), shown above the title. */
  treeSwitch?: ReactNode;
}

export function Header({ tree, doneCount, onCopy, onShare, onReset, playerLevelName, onChangeLevel, account, treeSwitch }: Props) {
  const total = tree.skills.length;
  const { current, next } = levelInfo(tree.levels, doneCount);
  const leveledUp = useIncreased(tree.levels.indexOf(current));
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function handleReset() {
    if (!armed) {
      setArmed(true);
      timer.current = window.setTimeout(() => setArmed(false), 3000);
      return;
    }
    window.clearTimeout(timer.current);
    setArmed(false);
    onReset();
  }

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
      <div className="actions">
        {account}
        {onChangeLevel && (
          <button className="btn" type="button" onClick={onChangeLevel}>
            {t.header.level(playerLevelName ?? null)}
          </button>
        )}
        <button className="btn" type="button" onClick={onShare}>
          {t.header.share}
        </button>
        <button className="btn" type="button" onClick={onCopy}>
          {t.header.copy}
        </button>
        <button className={`btn${armed ? " danger" : ""}`} type="button" onClick={handleReset}>
          {armed ? t.header.resetConfirm : t.header.reset}
        </button>
      </div>
    </header>
  );
}
