import { useEffect, useMemo, useRef, useState } from "react";
import { trees } from "./data";
import { activeTree, switchTree, treeSummaries } from "./lib/activeTree";
import { Header } from "./components/Header";
import { TreeSwitch } from "./components/TreeSwitch";
import { SkillTree } from "./components/SkillTree";
import { NextUpCard } from "./components/NextUpCard";
import { nextUp as suggestNext } from "./components/nextUp";
import { SkillPanel } from "./components/SkillPanel";
import { BranchTabs } from "./components/BranchTabs";
import { useMediaQuery } from "./components/useMediaQuery";
import { LevelPicker } from "./components/LevelPicker";
import { LevelUpBanner } from "./components/LevelUpBanner";
import { LevelTestDialog } from "./components/LevelTestDialog";
import { PracticeBar } from "./components/PracticeBar";
import { useToday } from "./components/useToday";
import { ShareDialog } from "./components/ShareDialog";
import { shareStats, type ShareStats } from "./components/shareImage";
import { TabBar, type Tab } from "./components/TabBar";
import { ProgressScreen } from "./components/ProgressScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { useAuth } from "./auth/useAuth";
import {
  clearPlayerLevel,
  levelInfo,
  loadPlayerLevel,
  loadPlayerStep,
  loadProgress,
  newlyUnlocked,
  progressSummary,
  rungName,
  savePlayerLevel,
  savePlayerStep,
  saveProgress,
  targetFor,
  type Rung,
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
import { saveLiftLog } from "./lib/lifts";
import type { SavedProgress } from "./lib/cloud";
import { useCloudSync } from "./lib/useCloudSync";
import { t } from "./i18n";

export default function App() {
  // The tree the player last chose (src/lib/activeTree.ts). Switching reloads the app.
  const [tree] = useState(() => activeTree(trees));
  const auth = useAuth();
  const [done, setDone] = useState<Set<string>>(() => loadProgress(tree.id));
  const [selectedId, setSelectedId] = useState(tree.skills[0].id);
  // Not in the URL: Google sign-in comes back with its tokens in the address's # part.
  const [tab, setTab] = useState<Tab>("train");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  // Where Train was scrolled when you left it. Some browsers reset a scroll area that gets hidden.
  const trainRef = useRef<HTMLDivElement>(null);
  const trainScroll = useRef<number[]>([]);
  // Keep in sync with the phone media query in index.css. The height clause catches phones held sideways.
  const isPhone = useMediaQuery("(max-width: 700px), (max-height: 500px) and (pointer: coarse)");
  const [branchId, setBranchId] = useState(tree.branches[0].id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [playerLevelId, setPlayerLevelId] = useState<string | null>(() => loadPlayerLevel(tree));
  const hasLevels = (tree.playerLevels?.length ?? 0) > 0;
  // Ask on first visit; after that, only when the player asks to change.
  const [pickerOpen, setPickerOpen] = useState(() => hasLevels && loadPlayerLevel(tree) === null);
  const [playerStep, setPlayerStep] = useState(() => loadPlayerStep(tree.id));
  // Where the player trains: their level and the step inside it, e.g. Beginner 2.
  const rung: Rung | null = playerLevelId ? { levelId: playerLevelId, step: playerStep } : null;
  const playerRungName = rungName(tree, rung);
  const [practiceDays, setPracticeDays] = useState(() => loadPracticeDays(tree.id));
  const [streakState, setStreakState] = useState(() => loadStreakState(tree.id));
  const [testOpen, setTestOpen] = useState(false);
  // Snapshot of the progress when Share was tapped, so the image isn't redrawn on every re-render.
  const [sharing, setSharing] = useState<ShareStats | null>(null);
  const today = useToday();
  const trainedToday = practiceDays.includes(today);
  const nextUp = pickerOpen || testOpen ? null : levelUpDue(tree, rung, practiceDays, today, streakState);
  const nextForTest = levelUpDue(tree, rung, practiceDays, today, streakState);
  const testItems = nextForTest
    ? tree.skills.flatMap((s) => {
        const target = targetFor(tree, s, nextForTest);
        return target ? [{ skillName: s.name, target }] : [];
      })
    : [];
  const selectedSkill = tree.skills.find((s) => s.id === selectedId)!;

  // Everything that is saved to a signed-in player's account.
  const progress: SavedProgress = useMemo(
    () => ({ done: [...done], playerLevel: playerLevelId, playerStep, practiceDays, streak: streakState }),
    [done, playerLevelId, playerStep, practiceDays, streakState],
  );
  const cloud = useCloudSync({ tree, userId: auth.account?.id ?? null, progress, apply: applySaved, onMessage: showToast });
  const accountAuth = {
    ...auth,
    // Send any waiting save before signing out, while the account can still be written to.
    signOut: async () => {
      await cloud.flush();
      await auth.signOut();
    },
    // Drop any waiting save before deleting the account, so nothing is sent to an account that's gone.
    deleteAccount: async () => {
      cloud.discard();
      return auth.deleteAccount();
    },
  };

  // The switch's counts come from the browser, except the open tree's, which can be a change ahead.
  const treeChoices = treeSummaries(trees, tree).map((choice) =>
    choice.active ? { ...choice, done: tree.skills.filter((s) => done.has(s.id)).length } : choice,
  );

  /** Send any waiting save to the account (up to 3 seconds), then reload into the other tree. */
  async function switchToTree(id: string) {
    await Promise.race([cloud.flush(), new Promise((resolve) => window.setTimeout(resolve, 3000))]);
    switchTree(trees, tree, id);
  }

  /** Show progress loaded from the account, and keep it in the browser too. */
  function applySaved(p: SavedProgress) {
    setDone(new Set(p.done));
    setPracticeDays(p.practiceDays);
    savePracticeDays(tree.id, p.practiceDays);
    // An account without a level never clears the level picked in this browser.
    if (p.playerLevel) {
      setPlayerLevelId(p.playerLevel);
      savePlayerLevel(tree.id, p.playerLevel);
      setPlayerStep(p.playerStep);
      savePlayerStep(tree.id, p.playerStep);
      updateStreak(p.streak);
      setPickerOpen(false);
    }
  }

  function updateStreak(next: StreakState) {
    setStreakState(next);
    saveStreakState(tree.id, next);
  }

  function toggleTrainedToday() {
    // Work the date out now: the page may have been open since yesterday.
    const now = dayKey(new Date());
    const next = practiceDays.includes(now) ? practiceDays.filter((d) => d !== now) : [...practiceDays, now];
    setPracticeDays(next);
    savePracticeDays(tree.id, next);
  }

  function askLater() {
    setTestOpen(false);
    updateStreak({ ...streakState, askedWeek: weekOf(dayKey(new Date())) });
  }

  function moveTo(next: Rung) {
    // Moving to a different step starts a fresh streak. The very first pick doesn't, so that week counts.
    const moved = rung !== null && (next.levelId !== rung.levelId || next.step !== rung.step);
    if (moved) updateStreak({ since: weekOf(dayKey(new Date())), askedWeek: null });
    setPlayerLevelId(next.levelId);
    savePlayerLevel(tree.id, next.levelId);
    setPlayerStep(next.step);
    savePlayerStep(tree.id, next.step);
    showToast(t.app.showingTargets(rungName(tree, next) ?? ""));
  }

  /** From the Level picker: the same level keeps your step, any other level starts at its step 1. */
  function pickLevel(id: string) {
    setPickerOpen(false);
    moveTo({ levelId: id, step: id === playerLevelId ? playerStep : 1 });
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
    if (after !== before) showToast(t.app.newRank(after));
    else if (unlocked.length) showToast(t.app.skillCompleteUnlocked(skill.name, unlocked.map((s) => s.name)));
    else showToast(t.app.skillComplete(skill.name));
  }

  function undo(id: string) {
    const next = new Set(done);
    next.delete(id);
    setDone(next);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(progressSummary(tree, done, rung));
      showToast(t.app.copied);
    } catch {
      showToast(t.app.copyFailed);
    }
  }

  /** Clears everything for this tree: finished skills, level and step, training days, streak and logged weights. */
  function reset() {
    setDone(new Set());
    setPlayerLevelId(null);
    setPlayerStep(1);
    clearPlayerLevel(tree.id);
    setPracticeDays([]);
    savePracticeDays(tree.id, []);
    updateStreak({ since: null, askedWeek: null });
    saveLiftLog(tree.id, []);
    setTestOpen(false);
    setSelectedId(tree.skills[0].id);
    setBranchId(tree.branches[0].id);
    setSheetOpen(false);
    setPickerOpen(hasLevels);
    showToast(t.app.resetDone);
  }

  const streak = streakWeeks(practiceDays, streakState.since);
  const suggested = suggestNext(tree, done);

  /** Train's two scroll areas: the whole tab (phones) and the tree (wider screens). */
  function trainScrollers(): HTMLElement[] {
    const train = trainRef.current;
    const tree = train?.querySelector<HTMLElement>(".tree-wrap");
    return [train, tree].filter((e): e is HTMLElement => !!e);
  }

  // Back on Train: put both scroll areas where they were.
  useEffect(() => {
    if (tab !== "train") return;
    trainScrollers().forEach((e, i) => (e.scrollTop = trainScroll.current[i] ?? e.scrollTop));
  }, [tab]);

  // A new branch on a phone: if the list's start is hidden under the pinned branch tabs, scroll up to it.
  useEffect(() => {
    const train = trainRef.current;
    const tabs = train?.querySelector<HTMLElement>(".branch-tabs");
    const list = train?.querySelector<HTMLElement>("main");
    if (!train || !tabs || !list) return;
    const listStart = train.scrollTop + list.getBoundingClientRect().top - train.getBoundingClientRect().top;
    const want = listStart - tabs.offsetHeight;
    if (train.scrollTop > want) train.scrollTop = want;
  }, [branchId]);

  return (
    <div className="app">
      <TabBar
        active={tab}
        onChange={(next) => {
          if (tab === "train") trainScroll.current = trainScrollers().map((e) => e.scrollTop);
          setTab(next);
          setSheetOpen(false);
        }}
        rank={levelInfo(tree.levels, done.size).current.name}
        summary={[t.header.skillsCount(done.size, tree.skills.length), ...(playerRungName ? [playerRungName] : [])]}
      />
      <div className="content">
        <div className="train" hidden={tab !== "train"} ref={trainRef}>
          <Header
            tree={tree}
            doneCount={done.size}
            playerLevelName={playerRungName}
            onChangeLevel={hasLevels ? () => setPickerOpen(true) : undefined}
            treeSwitch={<TreeSwitch trees={treeChoices} onSwitch={switchToTree} />}
          />
          {hasLevels && playerLevelId && (
            <PracticeBar
              daysThisWeek={daysThisWeek(practiceDays, today)}
              streak={streak}
              trainedToday={trainedToday}
              onToggle={toggleTrainedToday}
            />
          )}
          {nextUp && <LevelUpBanner onYes={() => setTestOpen(true)} onLater={askLater} />}
          {suggested && (
            <NextUpCard
              tree={tree}
              skill={suggested}
              done={done}
              onOpen={(s) => {
                if (s.branch) setBranchId(s.branch);
                select(s.id);
              }}
            />
          )}
          {isPhone && <BranchTabs tree={tree} done={done} activeId={branchId} onChange={setBranchId} />}
          <main>
            <SkillTree
              nextId={suggested?.id ?? null}
              tree={tree}
              done={done}
              selectedId={selectedId}
              onSelect={select}
              branchId={isPhone ? branchId : null}
            />
            {/* Not kept while Train is hidden, so a playing video stops. */}
            {tab === "train" && (!isPhone || sheetOpen) && (
              <SkillPanel
                tree={tree}
                done={done}
                skillId={selectedId}
                onComplete={complete}
                onUndo={undo}
                onClose={isPhone ? () => setSheetOpen(false) : undefined}
                playerLevelName={playerRungName}
                target={targetFor(tree, selectedSkill, rung)}
                onChangeLevel={() => setPickerOpen(true)}
              />
            )}
          </main>
        </div>
        {tab === "progress" && (
          <ProgressScreen
            tree={tree}
            doneCount={done.size}
            playerLevelName={playerRungName}
            daysThisWeek={daysThisWeek(practiceDays, today)}
            streakWeeks={streak}
            onShare={() => setSharing(shareStats(tree, done, playerRungName, streak, window.location.host))}
          />
        )}
        {tab === "settings" && (
          <SettingsScreen
            auth={accountAuth}
            treeName={tree.shortName ?? tree.title}
            playerLevelName={playerRungName}
            onChangeLevel={hasLevels ? () => setPickerOpen(true) : undefined}
            onCopy={copy}
            onReset={reset}
            onDeleted={() => showToast(t.app.accountDeleted)}
          />
        )}
      </div>
      {pickerOpen && tree.playerLevels && (
        <LevelPicker
          levels={tree.playerLevels}
          currentId={playerLevelId}
          onPick={pickLevel}
          canPick={(id) => canPickLevel(tree, playerLevelId, id)}
          // Skipping saves nothing, so the picker asks again next visit. Players who skip
          // (or whose browser can't save, like private windows) can still pick from the panel.
          onClose={() => setPickerOpen(false)}
          closeLabel={playerLevelId ? t.app.cancel : t.app.skipForNow}
        />
      )}
      {testOpen && nextForTest && (
        <LevelTestDialog
          nextName={rungName(tree, nextForTest) ?? ""}
          items={testItems}
          onPass={() => {
            setTestOpen(false);
            moveTo(nextForTest);
          }}
          onNotYet={askLater}
          onDismiss={() => setTestOpen(false)}
        />
      )}
      {sharing && <ShareDialog stats={sharing} onClose={() => setSharing(null)} />}
      <div className={`toast${toast ? " show" : ""}`} role="status">
        {toast}
      </div>
    </div>
  );
}
