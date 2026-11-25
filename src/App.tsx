import { useEffect, useMemo, useRef, useState } from "react";
import { treesIn, upcomingTrees } from "./data";
import { activeBranch, activeTree, saveActiveBranch, saveActiveTree, switchTree, treeSummaries } from "./lib/activeTree";
import { Header } from "./components/Header";
import { SkillTree, type ScrollRequest } from "./components/SkillTree";
import { branchFocusSkill, revealTarget } from "./components/treeView";
import { NextUpCard } from "./components/NextUpCard";
import { SkillPanel } from "./components/SkillPanel";
import { useMediaQuery } from "./components/useMediaQuery";
import { LevelPicker } from "./components/LevelPicker";
import { LevelUpBanner } from "./components/LevelUpBanner";
import { LevelTestDialog } from "./components/LevelTestDialog";
import { PracticeBar } from "./components/PracticeBar";
import { useToday } from "./components/useToday";
import { ShareDialog } from "./components/ShareDialog";
import { shareStats, type ShareStats } from "./components/shareImage";
import { AreasScreen } from "./components/AreasScreen";
import { TabBar, type Tab } from "./components/TabBar";
import { TrainingScreen } from "./components/TrainingScreen";
import { usePlan } from "./components/usePlan";
import { ProgressScreen } from "./components/ProgressScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { useAuth } from "./auth/useAuth";
import { SignInDialog } from "./components/SignInDialog";
import { challengeResult, challengeText, shareChallenge } from "./lib/challenge";
import { bestResult, resultDirection } from "./lib/results";
import { skillFromSearch, skillUrl, withoutSkillParam } from "./lib/skillLink";
import { loadWelcomeSkipped, saveWelcomeSkipped } from "./lib/welcome";
import {
  clearPlayerLevel,
  levelInfo,
  loadPlayerLevel,
  loadPlayerStep,
  loadProgress,
  newlyUnlocked,
  nextRung,
  nextSkill,
  progressSummary,
  rungName,
  savePlayerLevel,
  savePlayerStep,
  saveProgress,
  targetFor,
  testTargets,
  timeLimit,
  type Rung,
} from "./lib/progress";
import {
  canPickLevel,
  needsPlacementTest,
  dayKey,
  daysThisWeek,
  levelUpDue,
  loadPracticeDays,
  loadStreakState,
  savePracticeDays,
  addTrainingDay,
  saveStreakState,
  streakWeeks,
  weekCanCount,
  weekNudge,
  weekOf,
  type StreakState,
} from "./lib/streak";
import { useLiftLog } from "./components/useLiftLog";
import { useResults } from "./components/useResults";
import { useSessions } from "./components/useSessions";
import { undoPass, withoutSkill } from "./components/undoPass";
import type { SavedProgress } from "./lib/cloud";
import { useCloudSync } from "./lib/useCloudSync";
import { LeaderboardScreen } from "./components/LeaderboardScreen";
import { LeaderboardProfileDialog } from "./components/LeaderboardProfileDialog";
import { useLeaderboardProfile } from "./lib/useLeaderboardProfile";
import { LEADERBOARD_TREE } from "./lib/leaderboardApi";
import { chooseLanguage, language, t, type Language } from "./i18n";

// The trees with their skill content in the app's language (English where a translation is missing).
const trees = treesIn(language);

interface ToastAction {
  label: string;
  /** What a screen reader says, when the visible label alone is unclear ("Undo" what?). */
  accessibleLabel?: string;
  run: () => void;
}

interface Toast {
  text: string;
  action?: ToastAction;
}

export default function App() {
  // The tree the player last chose (src/lib/activeTree.ts). Switching reloads the app.
  // A shared link (?skill=ps3) opens that skill, in whichever tree has it. Read once per page load.
  const [link] = useState(() => skillFromSearch(trees, window.location.search));
  const [tree] = useState(() => link?.tree ?? activeTree(trees));
  const auth = useAuth();
  // The sign-in screen that opens the app. Decided once per page load: a player who is signed in
  // when the session check finishes never sees it, so signing out or an expired session later doesn't bring it up.
  const [welcomeSkipped, setWelcomeSkipped] = useState(loadWelcomeSkipped);
  const [welcomeHidden, setWelcomeHidden] = useState(false);
  useEffect(() => {
    if (!auth.loading && auth.account) setWelcomeHidden(true);
  }, [auth.loading, auth.account]);
  const welcomeOpen = auth.configured && !auth.loading && !auth.account && !welcomeSkipped && !welcomeHidden;
  // Weights logged on lifts (Strength tree). Saved in this browser and, when signed in, in the account.
  const lifts = useLiftLog(tree);
  // Times saved from test mode (sprints). Saved to the account too, like the lift log.
  const results = useResults(tree);
  // Which skills were trained on which day (idea 5). Saved to the account too, like the lift log.
  const sessions = useSessions(tree);
  const [done, setDone] = useState<Set<string>>(() => loadProgress(tree));
  const [selectedId, setSelectedId] = useState(link?.skillId ?? tree.skills[0].id);
  // Not in the URL: Google sign-in comes back with its tokens in the address's # part.
  const [tab, setTab] = useState<Tab>("train");
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  // Where Train was scrolled when you left it. Some browsers reset a scroll area that gets hidden.
  const trainRef = useRef<HTMLDivElement>(null);
  const trainScroll = useRef<number[]>([]);
  // Keep in sync with the phone media query in index.css. The height clause catches phones held sideways.
  const isPhone = useMediaQuery("(max-width: 700px), (max-height: 500px) and (pointer: coarse)");
  // The branch pill: highlighted in the tree, and remembered in this browser. null is "All".
  const [branchId, setBranchId] = useState<string | null>(
    () => (link && tree.skills.find((s) => s.id === link.skillId)?.branch) || activeBranch(tree),
  );
  // Where the tree should scroll to next (after picking a branch, or when a skill opens).
  const [scrollTo, setScrollTo] = useState<ScrollRequest | null>(link ? { id: link.skillId } : null);
  const [sheetOpen, setSheetOpen] = useState(link !== null);
  const [playerLevelId, setPlayerLevelId] = useState<string | null>(() => loadPlayerLevel(tree));
  const hasLevels = (tree.playerLevels?.length ?? 0) > 0;
  // Ask on first visit; after that, only when the player asks to change.
  const [pickerOpen, setPickerOpen] = useState(() => hasLevels && loadPlayerLevel(tree) === null);
  // The button that opened the picker, so closing it returns focus there even if that button was hidden meanwhile.
  const pickerOpener = useRef<HTMLElement | null>(null);
  function openPicker() {
    pickerOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPickerOpen(true);
  }
  const [playerStep, setPlayerStep] = useState(() => loadPlayerStep(tree.id));
  // Where the player trains: their level and the step inside it, e.g. Beginner 2.
  const rung: Rung | null = playerLevelId ? { levelId: playerLevelId, step: playerStep } : null;
  const playerRungName = rungName(tree, rung);
  const [practiceDays, setPracticeDays] = useState(() => loadPracticeDays(tree.id));
  const [streakState, setStreakState] = useState(() => loadStreakState(tree.id));
  const [testOpen, setTestOpen] = useState(false);
  // A first pick above the easiest level: the level being tested, until the player passes or picks again.
  const [placementId, setPlacementId] = useState<string | null>(null);
  // Snapshot of the progress when Share was tapped, so the image isn't redrawn on every re-render.
  const [sharing, setSharing] = useState<ShareStats | null>(null);
  const today = useToday();
  const trainedToday = practiceDays.includes(today);
  const planState = usePlan(tree, done, playerLevelId, today);
  const nextUp = pickerOpen || testOpen || placementId ? null : levelUpDue(tree, rung, practiceDays, today, streakState);
  const nextForTest = levelUpDue(tree, rung, practiceDays, today, streakState);
  const testItems = testTargets(tree, nextForTest, language);
  const placementRung: Rung | null = placementId ? { levelId: placementId, step: 1 } : null;
  const selectedSkill = tree.skills.find((s) => s.id === selectedId)!;

  // Everything that is saved to a signed-in player's account.
  const progress: SavedProgress = useMemo(
    () => ({ done: [...done], playerLevel: playerLevelId, playerStep, practiceDays, streak: streakState, liftLog: lifts.log, results: results.results, sessions: sessions.sessions }),
    [done, playerLevelId, playerStep, practiceDays, streakState, lifts.log, results.results, sessions.sessions],
  );
  // The ranked leaderboard (#96): the player's profile, and whether its screen or its profile dialog is open.
  const leaderboard = useLeaderboardProfile(auth.account?.id ?? null);
  const hasLeaderboard = tree.id === LEADERBOARD_TREE;
  const [boardOpen, setBoardOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => {
    if (!hasLeaderboard) setBoardOpen(false);
  }, [hasLeaderboard]);
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
  const treeChoices = treeSummaries(trees, tree, upcomingTrees).map((choice) =>
    choice.active ? { ...choice, done: tree.skills.filter((s) => done.has(s.id)).length } : choice,
  );

  /** Send any waiting save to the account (up to 3 seconds), then reload into the other tree. */
  async function switchToTree(id: string) {
    await Promise.race([cloud.flush(), new Promise((resolve) => window.setTimeout(resolve, 3000))]);
    switchTree(trees, tree, id);
  }

  /** Like switching trees: send any waiting save first, then reload in the new language. */
  async function switchLanguage(code: Language | null) {
    await Promise.race([cloud.flush(), new Promise((resolve) => window.setTimeout(resolve, 3000))]);
    chooseLanguage(code);
  }

  /** Show progress loaded from the account, and keep it in the browser too. */
  function applySaved(p: SavedProgress) {
    setDone(new Set(p.done));
    lifts.replace(p.liftLog ?? []);
    results.replace(p.results ?? []);
    sessions.replace(p.sessions ?? []);
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

  /** Passing a test counts as training today (#46). Only adds the day: undoing a pass leaves it. */
  function markTrainedToday() {
    const next = addTrainingDay(practiceDays, dayKey(new Date()));
    if (next === practiceDays) return;
    setPracticeDays(next);
    savePracticeDays(tree.id, next);
  }

  /** "Finish session" on the Training tab: a finished planned session counts as a training day. */
  function finishSession() {
    markTrainedToday();
    showToast(t.training.finished);
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
    if (needsPlacementTest(tree, playerLevelId, id)) {
      setPlacementId(id);
      return;
    }
    moveTo({ levelId: id, step: id === playerLevelId ? playerStep : 1 });
  }

  /** From the branch pills: remember the pick, highlight that branch and scroll to where the player is in it. */
  function chooseBranch(id: string | null) {
    setBranchId(id);
    saveActiveBranch(tree.id, id);
    const target = id === null ? null : branchFocusSkill(tree, id, done);
    if (target) setScrollTo({ id: target.id });
  }

  // Take ?skill= out of the address bar once it's been read, so a reload or a tree switch doesn't reopen it.
  useEffect(() => {
    if (!link) return;
    saveActiveTree(link.tree.id);
    window.history.replaceState(window.history.state, "", withoutSkillParam(window.location.href));
  }, [link]);

  function copySkillLink(id: string) {
    const url = skillUrl(window.location.href, id, tree.id);
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(url))
      .then(() => showToast(t.app.linkCopied))
      .catch(() => window.prompt(t.panel.copyLink, url));
  }

  // Shares "I did X in 13.2 s. Beat it?" with the player's best time for the skill (not the run that just ended)
  // plus the skill link: the share sheet where there is one, else the clipboard.
  // Only stopwatch tests save a number (the button is hidden for other kinds), so the result is always seconds.
  function challengeMate(skillId: string) {
    const skill = tree.skills.find((s) => s.id === skillId);
    const better = skill ? resultDirection(tree, skill) : null;
    const value = bestResult(tree, results.results, skillId)?.value;
    if (!skill || !better || value === undefined) return;
    const url = skillUrl(window.location.href, skillId, tree.id);
    const text = challengeText(skill.name, challengeResult(value), better, url);
    void shareChallenge(t.challenge.title(skill.name), text, t.challenge.copyPrompt, () => showToast(t.challenge.copied), {
      share: typeof navigator.share === "function" ? (d) => navigator.share(d) : undefined,
      writeText: navigator.clipboard ? (v) => navigator.clipboard.writeText(v) : undefined,
      prompt: (m, v) => window.prompt(m, v),
    });
  }

  function select(id: string) {
    setSelectedId(id);
    setSheetOpen(true);
  }

  // By id, not "whatever had focus": iOS Safari doesn't focus a button on tap, and the sheet can
  // switch skills while open.
  // If the Train view is hidden (the toast's Undo can be tapped from Progress or Settings), focus
  // goes to the current tab's button instead of falling to the page.
  function focusSkill(id: string) {
    const buttons = trainRef.current?.querySelectorAll<HTMLElement>(`[data-skill-id="${CSS.escape(id)}"]`) ?? [];
    const visible = Array.from(buttons).find((b) => b.offsetParent !== null);
    const target = visible ?? document.querySelector<HTMLElement>('.tabbar [aria-current="page"]');
    target?.focus();
  }

  function closeSheet(id = selectedId) {
    setSheetOpen(false);
    focusSkill(id);
  }

  // The history entry only means something while the sheet is open. After a reload it would be an empty step
  // that Back appears to do nothing on, so drop its mark.
  useEffect(() => {
    if (window.history.state?.skillSheet) window.history.replaceState({ ...window.history.state, skillSheet: false }, "");
  }, []);

  // The phone's back gesture (Android) closes the sheet instead of leaving the app: an open sheet
  // adds a history entry, and every other way of closing it takes that entry off again.
  const sheetInHistory = useRef(false);
  const closeSheetRef = useRef(closeSheet);
  useEffect(() => {
    closeSheetRef.current = closeSheet;
  });
  const sheetShown = isPhone && sheetOpen;
  useEffect(() => {
    if (!sheetShown) {
      if (sheetInHistory.current) {
        sheetInHistory.current = false;
        window.history.back();
      }
      return;
    }
    if (!sheetInHistory.current) {
      window.history.pushState({ ...window.history.state, skillSheet: true }, "");
      sheetInHistory.current = true;
    }
    const onPop = () => {
      sheetInHistory.current = false;
      closeSheetRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [sheetShown]);

  // Forward onto the sheet's entry (after Back closed it) opens the sheet again, so history and sheet agree.
  useEffect(() => {
    if (!isPhone) return;
    const onPop = (e: PopStateEvent) => {
      if (!e.state?.skillSheet || sheetInHistory.current) return;
      sheetInHistory.current = true;
      setSheetOpen(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isPhone]);

  useEffect(() => saveProgress(tree.id, done), [tree.id, done]);
  // The toast's Undo runs after later renders (a cloud load can land in between), so it reads this.
  const doneRef = useRef(done);
  useEffect(() => {
    doneRef.current = done;
  }, [done]);

  /** A short message. With an action (Undo), it stays longer so there's time to tap it. */
  function showToast(text: string, action?: ToastAction) {
    setToast({ text, action });
    hideToastIn(action ? 6000 : 2800);
  }

  function hideToastIn(ms: number) {
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  }

  function complete(id: string) {
    const skill = tree.skills.find((s) => s.id === id)!;
    const unlocked = newlyUnlocked(tree, done, id);
    const next = new Set(done).add(id);
    const before = levelInfo(tree.levels, done.size).current.name;
    const after = levelInfo(tree.levels, next.size).current.name;
    setDone(next);
    markTrainedToday();
    // The tree grows upward: follow the new growth up to the skill that just opened.
    const reveal = revealTarget(unlocked);
    if (reveal) setScrollTo({ id: reveal.id });
    // On laptops the panel stays on screen, but "I passed" turns into Undo there, so focus goes
    // to the skill in the tree, the same as on phones.
    if (sheetOpen) closeSheet(id);
    // Undo right here, for a mis-tap: the sheet has closed, so its own Undo is out of reach.
    const undoPass = { label: t.app.undo, accessibleLabel: t.app.undoPass(skill.name), run: () => undoPassed(id) };
    if (after !== before) showToast(t.app.newRank(after), undoPass);
    else if (unlocked.length) showToast(t.app.skillCompleteUnlocked(skill.name, unlocked.map((s) => s.name)), undoPass);
    else showToast(t.app.skillComplete(skill.name), undoPass);
  }

  /** Un-passes a skill, unless a skill that needs it has been passed since. Works from the latest progress, not a stale copy. */
  function undoPassed(id: string) {
    const skill = tree.skills.find((s) => s.id === id)!;
    const { blockers } = undoPass(tree, doneRef.current, id);
    if (blockers.length) {
      showToast(t.panel.undoFirst(blockers.map((s) => s.name)));
    } else {
      setDone((current) => undoPass(tree, current, id).done);
      showToast(t.app.undone(skill.name));
    }
    // The Undo button is gone, so focus goes to the skill instead of falling to the page.
    focusSkill(id);
  }

  function undo(id: string) {
    setDone((current) => withoutSkill(current, id));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(progressSummary(tree, done, rung, t.summary));
      showToast(t.app.copied);
    } catch {
      showToast(t.app.copyFailed);
    }
  }

  /** Clears everything for this tree: finished skills, level and step, training days, streak, logged weights and saved times. */
  function reset() {
    setDone(new Set());
    setPlayerLevelId(null);
    setPlayerStep(1);
    clearPlayerLevel(tree.id);
    setPracticeDays([]);
    savePracticeDays(tree.id, []);
    updateStreak({ since: null, askedWeek: null });
    lifts.clear();
    results.clear();
    sessions.clear();
    setTestOpen(false);
    setSelectedId(tree.skills[0].id);
    setBranchId(null);
    saveActiveBranch(tree.id, null);
    setSheetOpen(false);
    setPickerOpen(hasLevels);
    showToast(t.app.resetDone);
  }

  const streak = streakWeeks(practiceDays, streakState.since, today);
  const suggested = nextSkill(tree, done);

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

  const treeName = tree.shortName ?? tree.title;

  function goTo(next: Tab) {
    if (tab === "train") trainScroll.current = trainScrollers().map((e) => e.scrollTop);
    setTab(next);
    setBoardOpen(false);
    setSheetOpen(false);
  }

  return (
    <div className="app">
      <TabBar
        active={tab}
        onChange={goTo}
        rank={levelInfo(tree.levels, done.size).current.name}
        summary={[t.header.skillsCount(done.size, tree.skills.length), ...(playerRungName ? [playerRungName] : [])]}
      />
      <div className="content">
        <div className="train" hidden={tab !== "train"} ref={trainRef}>
          <Header
            tree={tree}
            doneCount={done.size}
            playerLevelName={playerRungName}
            onChangeLevel={hasLevels ? openPicker : undefined}
          />
          <div className="switcher">
            <button type="button" className="area-pill" aria-label={t.areas.change(treeName)} onClick={() => goTo("areas")}>
              {treeName}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </button>
          </div>
          {hasLevels && playerLevelId && (
            <PracticeBar
              daysThisWeek={daysThisWeek(practiceDays, today)}
              days={practiceDays}
              today={today}
              nudge={weekNudge(practiceDays, streakState.since, today)}
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
                if (s.branch) chooseBranch(s.branch);
                else setScrollTo({ id: s.id });
                select(s.id);
              }}
            />
          )}
          <main>
            <SkillTree
              nextId={suggested?.id ?? null}
              tree={tree}
              done={done}
              selectedId={selectedId}
              onSelect={select}
              branchId={branchId}
              phone={isPhone}
              scrollTo={scrollTo}
            />
            {/* Not kept while Train is hidden, so a playing video stops. */}
            {tab === "train" && sheetShown && !(pickerOpen || testOpen || placementId !== null) && (
              <div className="sheet-backdrop" aria-hidden="true" onClick={() => closeSheet()} />
            )}
            {tab === "train" && (!isPhone || sheetOpen) && (
              <SkillPanel
                tree={tree}
                done={done}
                skillId={selectedId}
                onComplete={complete}
                onUndo={undo}
                onClose={isPhone ? () => closeSheet() : undefined}
                playerLevelName={playerRungName}
                target={targetFor(tree, selectedSkill, rung, language)}
                onChangeLevel={openPicker}
                lifts={lifts}
                timeLimit={timeLimit(tree, selectedSkill, rung)}
                results={results}
                levelId={playerLevelId}
                planAdded={planState.added.includes(selectedId)}
                onTogglePlan={() => planState.toggleAdded(selectedId)}
                onCopyLink={copySkillLink}
                onChallenge={challengeMate}
                // One sheet at a time: on phones the skill sheet steps aside while a level dialog is open.
                hidden={isPhone && (pickerOpen || testOpen || placementId !== null)}
              />
            )}
          </main>
        </div>
        {tab === "areas" && (
          <AreasScreen
            tree={tree}
            done={done}
            trees={treeChoices}
            branchId={branchId}
            onSwitchTree={switchToTree}
            onPickBranch={(id) => {
              // Forget Train's saved scroll: restoring it runs after SkillTree's scroll to the branch and would undo it.
              trainScroll.current = [];
              goTo("train");
              chooseBranch(id);
            }}
          />
        )}
        {tab === "plan" && (
          <TrainingScreen tree={tree} state={planState} levelId={playerLevelId} today={today} practiceDays={practiceDays} onFinish={finishSession} />
        )}
        {tab === "progress" && boardOpen && hasLeaderboard && (
          <LeaderboardScreen
            tree={tree}
            auth={auth}
            profile={leaderboard.profile}
            profileLoading={leaderboard.loading}
            profileError={leaderboard.error}
            onRetryProfile={leaderboard.retry}
            onBack={() => setBoardOpen(false)}
            onEditProfile={() => setProfileOpen(true)}
            onSignIn={() => void auth.signInWithGoogle()}
          />
        )}
        {tab === "progress" && !(boardOpen && hasLeaderboard) && (
          <ProgressScreen
            tree={tree}
            done={done}
            playerLevelName={playerRungName}
            playerStep={playerStep}
            levelTestAhead={nextRung(tree, rung) !== null}
            practiceDays={practiceDays}
            today={today}
            daysThisWeek={daysThisWeek(practiceDays, today)}
            weekCanCount={weekCanCount(streakState.since, today)}
            streakWeeks={streak}
            liftLog={lifts.log}
            onShare={() => setSharing(shareStats(tree, done, playerRungName, streak, window.location.host))}
            onPickLevel={hasLevels ? () => setPickerOpen(true) : undefined}
            onOpenLeaderboard={hasLeaderboard ? () => setBoardOpen(true) : undefined}
          />
        )}
        {tab === "settings" && (
          <SettingsScreen
            auth={accountAuth}
            treeName={tree.shortName ?? tree.title}
            playerLevelName={playerRungName}
            onChangeLevel={hasLevels ? openPicker : undefined}
            onCopy={copy}
            onReset={reset}
            onLanguage={(code) => void switchLanguage(code)}
            onDeleted={() => showToast(t.app.accountDeleted)}
            leaderboard={hasLeaderboard ? leaderboard : undefined}
            onEditProfile={() => setProfileOpen(true)}
            onMessage={showToast}
          />
        )}
      </div>
      {welcomeOpen && (
        <SignInDialog
          welcome
          onGoogle={auth.signInWithGoogle}
          // Tapping outside or Escape only hides it for this visit. Only the Skip button remembers it.
          onClose={() => setWelcomeHidden(true)}
          onSkip={() => {
            saveWelcomeSkipped();
            setWelcomeSkipped(true);
          }}
        />
      )}
      {pickerOpen && !welcomeOpen && !auth.loading && tree.playerLevels && (
        <LevelPicker
          levels={tree.playerLevels}
          currentId={playerLevelId}
          onPick={pickLevel}
          canPick={(id) => canPickLevel(tree, playerLevelId, id)}
          // Skipping saves nothing, so the picker asks again next visit. Players who skip
          // (or whose browser can't save, like private windows) can still pick from the panel.
          onClose={() => setPickerOpen(false)}
          closeLabel={playerLevelId ? t.app.cancel : t.app.skipForNow}
          opener={pickerOpener.current}
        />
      )}
      {testOpen && nextForTest && (
        <LevelTestDialog
          nextName={rungName(tree, nextForTest) ?? ""}
          items={testItems}
          onPass={() => {
            setTestOpen(false);
            moveTo(nextForTest);
            markTrainedToday();
          }}
          onNotYet={askLater}
          onDismiss={() => setTestOpen(false)}
        />
      )}
      {placementRung && (
        <LevelTestDialog
          nextName={rungName(tree, placementRung) ?? ""}
          items={testTargets(tree, placementRung, language)}
          intro={t.levelTest.placementIntro(rungName(tree, placementRung) ?? "")}
          notYetLabel={t.levelTest.pickAnother}
          onPass={() => {
            setPlacementId(null);
            moveTo(placementRung);
            markTrainedToday();
          }}
          // Not passed yet: back to the picker, where the easiest level is always open.
          onNotYet={() => {
            setPlacementId(null);
            setPickerOpen(true);
          }}
          onDismiss={() => {
            setPlacementId(null);
            setPickerOpen(true);
          }}
        />
      )}
      {profileOpen && !leaderboard.error && (
        <LeaderboardProfileDialog
          initial={leaderboard.profile}
          onClose={() => setProfileOpen(false)}
          onSave={async (next) => {
            const problem = await leaderboard.save(next);
            if (!problem) {
              setProfileOpen(false);
              showToast(t.leaderboardProfile.saved);
            }
            return problem;
          }}
        />
      )}
      {sharing && <ShareDialog stats={sharing} onClose={() => setSharing(null)} />}
      <div className={`toast${toast ? " show" : ""}${toast?.action ? " has-action" : ""}`} role="status">
        {toast?.text}
        {toast?.action && (
          <button
            className="toast-action"
            type="button"
            aria-label={toast.action.accessibleLabel}
            // Not removed while it has keyboard focus; the countdown restarts when focus leaves.
            onFocus={() => window.clearTimeout(toastTimer.current)}
            onBlur={() => hideToastIn(2800)}
            onClick={() => {
              const action = toast.action!;
              setToast(null);
              action.run();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
