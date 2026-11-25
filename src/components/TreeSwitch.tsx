import { useState, type FocusEvent } from "react";
import type { TreeSummary } from "../lib/activeTree";
import { moveTabFocus } from "./tabKeys";
import { TREE_PANEL_ID } from "./treeView";
import { t } from "../i18n";

interface Props {
  trees: TreeSummary[];
  /** Switch to this tree. Resolves only if the switch failed; on success the page reloads. */
  onSwitch: (treeId: string) => Promise<void>;
}

/**
 * Level 1 of the switcher: Football / Strength, one pill per tree, as tabs. Picks which skill tree the
 * app shows. A tree that isn't built yet is a locked "Coming soon" pill. Hidden when there's only one pill.
 *
 * Keyboard: Left, Right, Home and End move between pills (the locked one too, so a screen reader finds it),
 * Enter or Space picks. Picking reloads the app, so moving focus doesn't pick by itself.
 */
export function TreeSwitch({ trees, onSwitch }: Props) {
  const [switching, setSwitching] = useState<string | null>(null);
  // The pill a Tab key press lands on. It follows the focus, and starts on the open tree.
  const [stop, setStop] = useState<string | null>(null);
  if (trees.length < 2) return null;
  const stopId = trees.some((tr) => tr.id === stop) ? stop : (trees.find((tr) => tr.active) ?? trees[0]).id;

  async function pick(tr: TreeSummary) {
    if (switching || tr.active || tr.soon) return;
    setSwitching(tr.id);
    await onSwitch(tr.id);
    setSwitching(null);
  }

  // Once focus leaves the row, the open tree is the Tab stop again.
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setStop(null);
  };

  return (
    <div className="tree-switch" role="tablist" aria-label={t.treeSwitch.label} onKeyDown={moveTabFocus} onBlur={onBlur}>
      {trees.map((tr) => (
        <button
          key={tr.id}
          type="button"
          role="tab"
          id={`tree-tab-${tr.id}`}
          className={`tree-switch-option${tr.soon ? " soon" : ""}`}
          aria-selected={tr.active}
          aria-controls={tr.active ? TREE_PANEL_ID : undefined}
          aria-disabled={tr.soon || (switching !== null && switching !== tr.id) ? true : undefined}
          aria-busy={switching === tr.id}
          aria-label={tr.soon ? t.treeSwitch.soonLabel(tr.shortName) : undefined}
          tabIndex={tr.id === stopId ? 0 : -1}
          onFocus={() => setStop(tr.id)}
          onClick={() => void pick(tr)}
        >
          <span className="tree-switch-name">{tr.shortName}</span>
          {tr.soon ? (
            <span className="tree-switch-soon">{t.treeSwitch.soon}</span>
          ) : (
            <span className="tree-switch-count">
              {tr.done}/{tr.total}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
