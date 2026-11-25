import type { Tree } from "../types";
import type { TreeSummary } from "../lib/activeTree";
import { BranchTabs } from "./BranchTabs";
import { TreeSwitch } from "./TreeSwitch";
import { t } from "../i18n";

interface Props {
  tree: Tree;
  done: Set<string>;
  trees: TreeSummary[];
  branchId: string | null;
  /** Switch to this tree. The page reloads on Train when it works. */
  onSwitchTree: (treeId: string) => Promise<void>;
  /** A branch was picked: the app goes back to the tree and shows it. */
  onPickBranch: (branchId: string | null) => void;
}

/** The "Areas" tab: pick Football or Strength, then a branch of it. Picking opens that part of Train. */
export function AreasScreen({ tree, done, trees, branchId, onSwitchTree, onPickBranch }: Props) {
  return (
    <section className="screen areas-screen" aria-labelledby="areas-title">
      <div className="screen-head">
        <h1 className="screen-title" id="areas-title">{t.areas.title}</h1>
      </div>
      <p className="areas-hint">{t.areas.hint}</p>
      <TreeSwitch trees={trees} onSwitch={onSwitchTree} />
      <h2 className="areas-sub">{t.areas.branches(tree.shortName ?? tree.title)}</h2>
      <BranchTabs tree={tree} done={done} activeId={branchId} onChange={onPickBranch} />
    </section>
  );
}
