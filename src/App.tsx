import { useEffect, useRef, useState } from "react";
import { trees } from "./data";
import { Header } from "./components/Header";
import { SkillTree } from "./components/SkillTree";
import { SkillPanel } from "./components/SkillPanel";
import { BranchTabs } from "./components/BranchTabs";
import { useMediaQuery } from "./components/useMediaQuery";
import {
  levelInfo,
  loadProgress,
  newlyUnlocked,
  progressSummary,
  saveProgress,
} from "./lib/progress";

export default function App() {
  const tree = trees[0];
  const [done, setDone] = useState<Set<string>>(() => loadProgress(tree.id));
  const [selectedId, setSelectedId] = useState(tree.skills[0].id);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  // Keep in sync with the phone media query in index.css. The height clause catches phones held sideways.
  const isPhone = useMediaQuery("(max-width: 700px), (max-height: 500px) and (pointer: coarse)");
  const [branchId, setBranchId] = useState(tree.branches[0].id);
  const [sheetOpen, setSheetOpen] = useState(false);

  function select(id: string) {
    setSelectedId(id);
    setSheetOpen(true);
  }

  useEffect(() => saveProgress(tree.id, done), [tree.id, done]);

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }

  function complete(id: string) {
    const skill = tree.skills.find((s) => s.id === id)!;
    const unlocked = newlyUnlocked(tree, done, id);
    const next = new Set(done).add(id);
    const before = levelInfo(tree.levels, done.size).current.name;
    const after = levelInfo(tree.levels, next.size).current.name;
    setDone(next);
    if (after !== before) showToast(`New level: ${after}.`);
    else if (unlocked.length) showToast(`${skill.name} complete. Unlocked: ${unlocked.map((s) => s.name).join(", ")}.`);
    else showToast(`${skill.name} complete.`);
  }

  function undo(id: string) {
    const next = new Set(done);
    next.delete(id);
    setDone(next);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(progressSummary(tree, done));
      showToast("Progress copied. Paste it anywhere.");
    } catch {
      showToast("Copy didn't work in this browser.");
    }
  }

  function reset() {
    setDone(new Set());
    setSelectedId(tree.skills[0].id);
    showToast("Progress reset.");
  }

  return (
    <div className="app">
      <Header tree={tree} doneCount={done.size} onCopy={copy} onReset={reset} />
      {isPhone && <BranchTabs tree={tree} done={done} activeId={branchId} onChange={setBranchId} />}
      <main>
        <SkillTree
          tree={tree}
          done={done}
          selectedId={selectedId}
          onSelect={select}
          branchId={isPhone ? branchId : null}
        />
        {(!isPhone || sheetOpen) && (
          <SkillPanel
            tree={tree}
            done={done}
            skillId={selectedId}
            onComplete={complete}
            onUndo={undo}
            onClose={isPhone ? () => setSheetOpen(false) : undefined}
          />
        )}
      </main>
      <div className={`toast${toast ? " show" : ""}`} role="status">
        {toast}
      </div>
    </div>
  );
}
