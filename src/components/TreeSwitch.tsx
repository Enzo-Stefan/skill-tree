import { useState } from "react";
import type { TreeSummary } from "../lib/activeTree";

interface Props {
  trees: TreeSummary[];
  /** Switch to this tree. Resolves only if the switch failed; on success the page reloads. */
  onSwitch: (treeId: string) => Promise<void>;
}

/** Football / Strength: picks which skill tree the app shows. Hidden when there's only one tree. */
export function TreeSwitch({ trees, onSwitch }: Props) {
  const [switching, setSwitching] = useState<string | null>(null);
  if (trees.length < 2) return null;

  async function pick(id: string) {
    if (switching) return;
    setSwitching(id);
    await onSwitch(id);
    setSwitching(null);
  }

  return (
    <div className="tree-switch" role="group" aria-label="Skill tree">
      {trees.map((t) => (
        <button
          key={t.id}
          type="button"
          className="tree-switch-option"
          aria-pressed={t.active}
          aria-busy={switching === t.id}
          disabled={switching !== null && switching !== t.id}
          onClick={() => (t.active ? undefined : void pick(t.id))}
        >
          <span className="tree-switch-name">{t.shortName}</span>
          <span className="tree-switch-count">
            {t.done}/{t.total}
          </span>
        </button>
      ))}
    </div>
  );
}
