import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Tree } from "../types";
import { levelInfo } from "../lib/progress";
import { useIncreased } from "./useIncreased";

interface Props {
  tree: Tree;
  doneCount: number;
  onCopy: () => void;
  onReset: () => void;
  /** Name of the player's chosen level, or null. Leave undefined for trees without levels. */
  playerLevelName?: string | null;
  onChangeLevel?: () => void;
  /** Sign in button or the signed-in account, shown first in the actions. */
  account?: ReactNode;
}

export function Header({ tree, doneCount, onCopy, onReset, playerLevelName, onChangeLevel, account }: Props) {
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
        <h1>{tree.title}</h1>
        <p>
          {tree.tagline} <a className="privacy-link" href="/privacy.html">Privacy</a>
        </p>
      </div>
      <div className="progress">
        <div className="progress-top">
          <span className={`level${leveledUp ? " bump" : ""}`}>{current.name}</span>
          <span className="count">
            {doneCount} of {total} skills
          </span>
        </div>
        <div className="bar">
          <span style={{ width: `${(doneCount / total) * 100}%` }} />
        </div>
        <span className="next-level">
          {next ? `${next.at - doneCount} more to reach ${next.name}` : "Every skill unlocked."}
        </span>
      </div>
      <div className="actions">
        {account}
        {onChangeLevel && (
          <button className="btn" type="button" onClick={onChangeLevel}>
            Level: {playerLevelName ?? "Pick"}
          </button>
        )}
        <button className="btn" type="button" onClick={onCopy}>
          Copy my progress
        </button>
        <button className={`btn${armed ? " danger" : ""}`} type="button" onClick={handleReset}>
          {armed ? "Tap again to reset all" : "Reset"}
        </button>
      </div>
    </header>
  );
}
