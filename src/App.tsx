import { useEffect, useRef, useState } from "react";
import { trees } from "./data";
import { Header } from "./components/Header";
import { SkillTree } from "./components/SkillTree";
import { SkillPanel } from "./components/SkillPanel";
import { BranchTabs } from "./components/BranchTabs";
import { useMediaQuery } from "./components/useMediaQuery";
import { LevelPicker } from "./components/LevelPicker";
import { LevelUpBanner } from "./components/LevelUpBanner";
import {
  levelInfo,
  levelUpOffer,
  loadLevelCheckpoint,
  loadPlayerLevel,
  loadProgress,
  newlyUnlocked,
  progressSummary,
  saveLevelCheckpoint,
  savePlayerLevel,
  saveProgress,
  targetFor,
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
  const [playerLevelId, setPlayerLevelId] = useState<string | null>(() => loadPlayerLevel(tree));
  const hasLevels = (tree.playerLevels?.length ?? 0) > 0;
  // Ask on first visit; after that, only when the player asks to change.
  const [pickerOpen, setPickerOpen] = useState(() => hasLevels && loadPlayerLevel(tree) === null);
  const playerLevelName = tree.playerLevels?.find((l) => l.id === playerLevelId)?.name ?? null;
  // Players who already have a level start counting from their current progress, so nobody is asked straight away.
  const [checkpoint, setCheckpoint] = useState(() => loadLevelCheckpoint(tree.id) ?? loadProgress(tree.id).size);
  const offer = pickerOpen ? null : levelUpOffer(tree, playerLevelId, done.size, checkpoint);
  const selectedSkill = tree.skills.find((s) => s.id === selectedId)!;

  function moveCheckpoint(count: number) {
    setCheckpoint(count);
    saveLevelCheckpoint(tree.id, count);
  }

  function pickLevel(id: string) {
    setPlayerLevelId(id);
    savePlayerLevel(tree.id, id);
    moveCheckpoint(done.size);
    setPickerOpen(false);
    const name = tree.playerLevels?.find((l) => l.id === id)?.name;
    showToast(`Showing ${name} targets.`);
  }

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
    setSheetOpen(false);
    if (after !== before) showToast(`New rank: ${after}.`);
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
      await navigator.clipboard.writeText(progressSummary(tree, done, playerLevelId));
      showToast("Progress copied. Paste it anywhere.");
    } catch {
      showToast("Copy didn't work in this browser.");
    }
  }

  function reset() {
    setDone(new Set());
    moveCheckpoint(0);
    setSelectedId(tree.skills[0].id);
    showToast("Progress reset.");
  }

  return (
    <div className="app">
      <Header
        tree={tree}
        doneCount={done.size}
        onCopy={copy}
        onReset={reset}
        playerLevelName={playerLevelName}
        onChangeLevel={hasLevels ? () => setPickerOpen(true) : undefined}
      />
      {offer && playerLevelName && (
        <LevelUpBanner
          finished={done.size - checkpoint}
          currentName={playerLevelName}
          nextName={offer.name}
          onAccept={() => pickLevel(offer.id)}
          onLater={() => moveCheckpoint(done.size)}
        />
      )}
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
            playerLevelName={playerLevelName}
            target={targetFor(selectedSkill, playerLevelId)}
            onChangeLevel={() => setPickerOpen(true)}
          />
        )}
      </main>
      {pickerOpen && tree.playerLevels && (
        <LevelPicker
          levels={tree.playerLevels}
          currentId={playerLevelId}
          onPick={pickLevel}
          // Skipping saves nothing, so the picker asks again next visit. Players who skip
          // (or whose browser can't save, like private windows) can still pick from the panel.
          onClose={() => setPickerOpen(false)}
          closeLabel={playerLevelId ? "Cancel" : "Skip for now"}
        />
      )}
      <div className={`toast${toast ? " show" : ""}`} role="status">
        {toast}
      </div>
    </div>
  );
}
