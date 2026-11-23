import { useEffect, useRef, useState } from "react";
import { trees } from "./data";
import { Header } from "./components/Header";
import { SkillTree } from "./components/SkillTree";
import { SkillPanel } from "./components/SkillPanel";
import { BranchTabs } from "./components/BranchTabs";
import { useMediaQuery } from "./components/useMediaQuery";
import { LevelPicker } from "./components/LevelPicker";
import { LevelUpBanner } from "./components/LevelUpBanner";
import { LevelTestDialog } from "./components/LevelTestDialog";
import { PracticeBar } from "./components/PracticeBar";
import { AccountMenu } from "./components/AccountMenu";
import { useAuth } from "./auth/useAuth";
import {
  levelInfo,
  loadPlayerLevel,
  loadProgress,
  newlyUnlocked,
  progressSummary,
  savePlayerLevel,
  saveProgress,
  targetFor,
} from "./lib/progress";
import {
  canPickLevel,
  dayKey,
  daysThisWeek,
  levelUpDue,
  loadPracticeDays,
  loadStreakState,
  savePracticeDays,
  saveStreakState,
  streakWeeks,
  weekOf,
  type StreakState,
} from "./lib/streak";

export default function App() {
  const tree = trees[0];
  const auth = useAuth();
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
  const [practiceDays, setPracticeDays] = useState(() => loadPracticeDays(tree.id));
  const [streakState, setStreakState] = useState(() => loadStreakState(tree.id));
  const [testOpen, setTestOpen] = useState(false);
  const today = dayKey(new Date());
  const trainedToday = practiceDays.includes(today);
  const nextLevel = pickerOpen || testOpen ? null : levelUpDue(tree, playerLevelId, practiceDays, today, streakState);
  const nextLevelForTest = levelUpDue(tree, playerLevelId, practiceDays, today, streakState);
  const testItems = nextLevelForTest
    ? tree.skills.flatMap((s) => {
        const target = targetFor(s, nextLevelForTest.id);
        return target ? [{ skillName: s.name, target }] : [];
      })
    : [];
  const selectedSkill = tree.skills.find((s) => s.id === selectedId)!;

  function updateStreak(next: StreakState) {
    setStreakState(next);
    saveStreakState(tree.id, next);
  }

  function toggleTrainedToday() {
    const next = trainedToday ? practiceDays.filter((d) => d !== today) : [...practiceDays, today];
    setPracticeDays(next);
    savePracticeDays(tree.id, next);
  }

  function askLater() {
    setTestOpen(false);
    updateStreak({ ...streakState, askedWeek: weekOf(today) });
  }

  function pickLevel(id: string) {
    // A different level starts a fresh streak.
    if (id !== playerLevelId) updateStreak({ since: weekOf(today), askedWeek: null });
    setPlayerLevelId(id);
    savePlayerLevel(tree.id, id);
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
        account={<AccountMenu auth={auth} />}
      />
      {hasLevels && playerLevelId && (
        <PracticeBar
          daysThisWeek={daysThisWeek(practiceDays, today)}
          streak={streakWeeks(practiceDays, today, streakState.since)}
          trainedToday={trainedToday}
          onToggle={toggleTrainedToday}
        />
      )}
      {nextLevel && <LevelUpBanner onYes={() => setTestOpen(true)} onLater={askLater} />}
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
          canPick={(id) => canPickLevel(tree, playerLevelId, id)}
          // Skipping saves nothing, so the picker asks again next visit. Players who skip
          // (or whose browser can't save, like private windows) can still pick from the panel.
          onClose={() => setPickerOpen(false)}
          closeLabel={playerLevelId ? "Cancel" : "Skip for now"}
        />
      )}
      {testOpen && nextLevelForTest && (
        <LevelTestDialog
          nextName={nextLevelForTest.name}
          items={testItems}
          onPass={() => {
            setTestOpen(false);
            pickLevel(nextLevelForTest.id);
          }}
          onLater={askLater}
        />
      )}
      <div className={`toast${toast ? " show" : ""}`} role="status">
        {toast}
      </div>
    </div>
  );
}
