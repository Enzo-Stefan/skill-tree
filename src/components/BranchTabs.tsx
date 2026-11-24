import type { CSSProperties } from "react";
import type { Tree } from "../types";
import { t } from "../i18n";

interface Props {
  tree: Tree;
  done: Set<string>;
  activeId: string;
  onChange: (branchId: string) => void;
}

export function BranchTabs({ tree, done, activeId, onChange }: Props) {
  return (
    <nav className="branch-tabs" aria-label={t.branchTabs.label}>
      {tree.branches.map((b) => {
        const skills = tree.skills.filter((s) => s.branch === b.id);
        const count = skills.filter((s) => done.has(s.id)).length;
        const active = b.id === activeId;
        return (
          <button
            key={b.id}
            type="button"
            className={`branch-tab${active ? " active" : ""}`}
            style={{ "--c": b.color } as CSSProperties}
            aria-pressed={active}
            onClick={() => onChange(b.id)}
          >
            {b.name}
            <span className="branch-tab-count">
              {count}/{skills.length}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
