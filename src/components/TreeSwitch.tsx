import { useState } from "react";
import type { TreeSummary } from "../lib/activeTree";
import { t } from "../i18n";

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
    <div className="tree-switch" role="group" aria-label={t.treeSwitch.label}>
      {trees.map((tr) => (
        <button
          key={tr.id}
          type="button"
          className="tree-switch-option"
          aria-pressed={tr.active}
          aria-busy={switching === tr.id}
          disabled={switching !== null && switching !== tr.id}
          onClick={() => (tr.active ? undefined : void pick(tr.id))}
        >
          <span className="tree-switch-name">{tr.shortName}</span>
          <span className="tree-switch-count">
            {tr.done}/{tr.total}
          </span>
        </button>
      ))}
    </div>
  );
}
