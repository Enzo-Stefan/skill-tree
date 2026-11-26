import { useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import type { Tree } from "../types";
import { ringFraction } from "./progressRing";
import { moveTabFocus } from "./tabKeys";
import { TREE_PANEL_ID } from "./treeView";
import { t } from "../i18n";

interface Props {
  tree: Tree;
  done: Set<string>;
  /** The branch picked, or null for "All". */
  activeId: string | null;
  onChange: (branchId: string | null) => void;
}

/** A ring around a dot: the share of the branch passed, drawn as an arc (the circle is 2 * pi * 10 long). */
function Ring({ done, total }: { done: number; total: number }) {
  const length = 2 * Math.PI * 10;
  return (
    <svg className="branch-ring" viewBox="0 0 26 26" aria-hidden="true">
      <circle className="ring-track" cx="13" cy="13" r="10" />
      {ringFraction(done, total) > 0 && (
        <circle className="ring-arc" cx="13" cy="13" r="10" strokeDasharray={`${ringFraction(done, total) * length} ${length}`} />
      )}
      <circle className="ring-dot" cx="13" cy="13" r="3.5" />
    </svg>
  );
}

const branchTabId = (branchId: string | null) => `branch-tab-${branchId ?? "all"}`;

/**
 * Level 2 of the switcher: a scrollable row of pills under the tree switch. "All" shows the whole
 * tree; a branch pill jumps to that branch and highlights it. They are tabs, and a pill gets picked
 * as soon as the arrow keys put focus on it, since picking one only scrolls and highlights.
 */
export function BranchTabs({ tree, done, activeId, onChange }: Props) {
  // The pill a Tab key press lands on. It follows the focus, and starts on the picked one.
  const [stop, setStop] = useState<string | null>(null);
  const picked = branchTabId(activeId);
  const stopId = stop ?? picked;
  const total = tree.skills.length;
  const doneTotal = tree.skills.filter((s) => done.has(s.id)).length;
  const ids = [null, ...tree.branches.map((b) => b.id)];

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const to = moveTabFocus(event);
    if (to !== null) onChange(ids[to]);
  }

  // Once focus leaves the row, the picked pill is the Tab stop again.
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setStop(null);
  };

  return (
    <div className="branch-tabs" role="tablist" aria-label={t.branchTabs.label} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        type="button"
        role="tab"
        id={branchTabId(null)}
        className={`branch-tab all${activeId === null ? " active" : ""}`}
        aria-selected={activeId === null}
        aria-controls={TREE_PANEL_ID}
        tabIndex={stopId === branchTabId(null) ? 0 : -1}
        onFocus={() => setStop(branchTabId(null))}
        onClick={() => onChange(null)}
      >
        <Ring done={doneTotal} total={total} />
        {t.branchTabs.all}
        <span className="branch-tab-count">
          {doneTotal}/{total}
        </span>
      </button>
      {tree.branches.map((b) => {
        const skills = tree.skills.filter((s) => s.branch === b.id);
        const count = skills.filter((s) => done.has(s.id)).length;
        const active = b.id === activeId;
        return (
          <button
            key={b.id}
            type="button"
            role="tab"
            id={branchTabId(b.id)}
            className={`branch-tab${active ? " active" : ""}`}
            style={{ "--c": b.color } as CSSProperties}
            aria-selected={active}
            aria-controls={TREE_PANEL_ID}
            tabIndex={stopId === branchTabId(b.id) ? 0 : -1}
            onFocus={() => setStop(branchTabId(b.id))}
            onClick={() => onChange(b.id)}
          >
            <Ring done={count} total={skills.length} />
            {b.name}
            <span className="branch-tab-count">
              {count}/{skills.length}
            </span>
          </button>
        );
      })}
    </div>
  );
}
