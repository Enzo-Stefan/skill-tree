/**
 * Every piece of app text in English, grouped by the screen it appears on.
 *
 * Skill content (drills, tests, tips, rank and level names) is not here: it lives in src/data/.
 * Text with numbers or names in it is a function, so each language can put them where its grammar needs.
 */
/** "A" or "A and B". */
function listAnd(items: string[]): string {
  return items.join(" and ");
}

export const en = {
  app: {
    train: "Train",
    showingTargets: (rung: string) => `Showing ${rung} targets.`,
    newRank: (rank: string) => `New rank: ${rank}.`,
    skillCompleteUnlocked: (skill: string, unlocked: string[]) => `${skill} complete. Unlocked: ${unlocked.join(", ")}.`,
    skillComplete: (skill: string) => `${skill} complete.`,
    copied: "Progress copied. Paste it anywhere.",
    copyFailed: "Copy didn't work in this browser.",
    resetDone: "All progress for this tree is reset.",
    accountDeleted: "Your account and its saved progress are deleted.",
    undo: "Undo",
    undoPass: (skill: string) => `Undo passing ${skill}`,
    undone: (skill: string) => `${skill} is back to ready to train.`,
    cancel: "Cancel",
    skipForNow: "Skip for now",
  },
  tabs: {
    label: "Main",
    brand: "hapi skill",
    train: "Train",
    progress: "Progress",
    settings: "Settings",
  },
  lifts: {
    title: "Your weights",
    best: "Personal best",
    /** A logged day, e.g. "3 Nov", with the year only when it isn't this year. */
    on: (date: string) => {
      const d = new Date(`${date}T12:00:00`);
      const thisYear = d.getFullYear() === new Date().getFullYear();
      return d.toLocaleDateString("en-GB", thisYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
    },
    empty: "Log the weight you used each time you do this lift, and your personal best shows here.",
    inputLabel: "Weight you used today",
    log: "Log",
    invalid: "Enter a weight from 0 to 500 kg, like 62.5.",
    newBest: (kg: string) => `New personal best: ${kg}!`,
    logged: (kg: string) => `Logged ${kg}.`,
    undo: "Undo",
    recent: "Latest weights",
    bestsTitle: "Personal bests",
    bestsEmpty: "Log a weight on any lift in this tree and your bests show here.",
    upFrom: (kg: string, times: number) => `Up from ${kg} · logged ${times} ${times === 1 ? "time" : "times"}`,
    timesLogged: (times: number) => `Logged ${times} ${times === 1 ? "time" : "times"}`,
  },
  progressScreen: {
    rankLabel: "Your rank",
    level: "Level",
    thisWeek: "This week",
    streak: "Streak",
  },
  settings: {
    training: "Training",
    yourLevel: "Your level",
    pickLevel: "Pick",
    account: "Account",
    signIn: "Sign in with Google",
    signInSub: "Keep your progress on every device",
    progress: "Progress",
    reset: "Reset everything",
    resetSub: (tree: string) => `Clears all your ${tree} progress`,
    language: "Language",
    /** The choice that follows the phone or browser language. */
    phoneLanguage: "Same as your phone",
    about: "About",
    privacy: "Privacy policy",
    privacySub: "What we save and how to delete it",
    followsPhone: "Light or dark follows your phone's setting.",
  },
  header: {
    skillsCount: (done: number, total: number) => `${done} of ${total} skills`,
    moreToReach: (left: number, rank: string) => `${left} more to reach ${rank}`,
    allUnlocked: "Every skill unlocked.",
    level: (name: string | null) => `Level: ${name ?? "Pick"}`,
    share: "Share my tree",
    copy: "Copy my progress",
    resetConfirm: "Tap again to reset all",
    privacy: "Privacy",
  },
  treeSwitch: {
    label: "Skill tree",
  },
  branchTabs: {
    label: "Branches",
  },
  tree: {
    /** Text inside the first and the last tile. */
    startTile: "GO",
    finalTile: "90'",
    nodeLabel: (skill: string, status: string, next: boolean) => `${skill}, ${status}${next ? ", next up" : ""}`,
    passed: "Passed",
    /** What a locked skill waits for. More than two (the final skill) becomes a count. */
    after: (skills: string[]) => (skills.length > 2 ? `After ${skills.length} more skills` : `After ${listAnd(skills)}`),
    branchCount: (done: number, total: number) => `${done} of ${total} done`,
    nextUp: "Next up",
  },
  nextUp: {
    start: "Start here. Every branch opens after it.",
    leastDone: (branch: string) => `${branch}: the branch you've done least`,
    /** When another branch has the same share done, so this one isn't "least". */
    goodNextStep: (branch: string) => `A good next step in ${branch}`,
    final: "The final skill",
  },
  panel: {
    status: { done: "Completed", available: "Ready to train", locked: "Locked" },
    startHere: "Start here",
    finalSkill: "Final skill",
    close: "Close",
    closeLabel: "Close skill details",
    finishFirst: (skills: string[]) => `Finish these first: ${skills.join(", ")}.`,
    drill: "The drill",
    test: "Pass the test",
    target: (rung: string) => `${rung} target`,
    changeLevel: "Change level",
    pickLevelForTarget: "Pick your level to see your target",
    tip: "Coach's tip",
    /** What the YouTube link searches for. Each tree gets words that find the right kind of video. */
    youtubeSearch: (treeId: string, skill: string) =>
      treeId === "football"
        ? `football ${skill} drill tutorial`
        : treeId === "weights"
          ? `${skill} exercise form tutorial`
          : `${skill} tutorial`,
    watchYoutube: "Watch tutorials on YouTube",
    passed: "I passed the test",
    undoFirst: (skills: string[]) => `To undo this, first undo: ${skills.join(", ")}.`,
    undo: "Undo",
  },
  testMode: {
    open: "Start test",
    openHint: "Counts or times the test for you at the pitch.",
    title: (skill: string) => `Test: ${skill}`,
    close: "Close",
    side: (n: number, total: number) => `Side ${n} of ${total}`,
    goalHits: (needed: number, attempts: number) => `Get ${needed} of ${attempts}.`,
    goalCount: (needed: number, inARow: boolean) => (inARow ? `${needed} in a row.` : `${needed} in total.`),
    goalCountTimed: (needed: number, time: string) => `${needed} in ${time}.`,
    goalTime: (time: string) => `Under ${time}.`,
    goalTimeNoLimit: "Pick your level to get a target time.",
    goalHold: (time: string) => `Hold for ${time}.`,
    /** A length of time in words, for the goal line: "60 seconds", "25 minutes", "1 min 30 s". */
    duration: (s: number) =>
      s < 60 ? `${s} seconds` : s % 60 === 0 ? `${s / 60} minutes` : `${Math.floor(s / 60)} min ${s % 60} s`,
    bestOf: (n: number) => `Best of ${n} runs.`,
    everyRun: (n: number) => `${n} runs, every one under the time.`,
    eachTry: (seconds: number) => `Each try lasts ${seconds} seconds.`,
    /** Under the big hit count: "hits from 6 tries". */
    hitsFrom: (tries: number) => `hits from ${tries} ${tries === 1 ? "try" : "tries"}`,
    /** Under the big count: "of 20". */
    countOf: (needed: number) => `of ${needed}`,
    hitsLeft: (left: number) => `${left} ${left === 1 ? "try" : "tries"} left`,
    hit: "Hit",
    miss: "Miss",
    add: "+1",
    addLabel: "Add one",
    slip: "Missed: start from 0",
    start: "Start",
    stop: "Stop",
    giveUp: "Stop early",
    undoTap: "Undo last tap",
    restart: "Start again",
    nextSide: "Start the other side",
    run: (n: number, total: number) => `Run ${n} of ${total}`,
    times: "Your times",
    passed: "Test passed!",
    sideDone: "First side done!",
    failed: "Not this time. Have another go.",
    finished: "Done. Pick your level to see if these times pass.",
    markPassed: "Mark the skill as passed",
    alreadyPassed: "You've already passed this skill.",
  },
  video: {
    offlineTitle: "Video needs internet",
    offlineBody: "The drill, test and tip all work offline.",
    label: (skill: string) => `${skill} video`,
    play: (skill: string) => `Play ${skill} video`,
    playNote: "Tap to play. This loads the video from YouTube.",
  },
  practice: {
    label: "Training this week",
    thisWeek: "This week:",
    days: (done: number, goal: number) => `${done} of ${goal}`,
    trainingDays: "training days",
    streak: "Streak:",
    weeks: (n: number) => `${n} ${n === 1 ? "week" : "weeks"}`,
    trained: "Trained today ✓ (tap to undo)",
    train: "I trained today",
  },
  levelUp: {
    label: "Level up question",
    trainedFor: (days: number, weeks: number) => `You've trained at least ${days} days a week for ${weeks} weeks.`,
    improved: "Do you think you've improved?",
    yes: "Yes",
    notYet: "Not yet",
  },
  levelPicker: {
    title: "What's your level?",
    lockedIntro: (days: number, weeks: number) =>
      `You can move to a lower level any time. To move up, train ${days} days a week for ${weeks} weeks and pass the test.`,
    intro: "Some tests have a different target for each level. You'll only see yours. The easiest level is open to everyone. For a higher one, you pass its test first.",
    lockedHint: "Pass the test to move up",
  },
  levelTest: {
    title: (rung: string) => `${rung} test`,
    intro: (rung: string) => `Do these at the ${rung} targets. Pass them all and you move up to ${rung}.`,
    passed: "I passed",
    notYet: "Not yet",
    placementIntro: (rung: string) => `To start at ${rung}, do these at its targets. Pass them all and you start there.`,
    pickAnother: "Pick another level",
  },
  share: {
    title: "Share my tree",
    imageAlt: (rank: string, done: number, total: number) => `${rank}: ${done} of ${total} skills`,
    drawing: "Drawing…",
    share: "Share",
    download: "Download",
    close: "Close",
    shareText: (done: number, total: number, title: string) => `${done} of ${total} skills on ${title}.`,
    shareFailed: "Sharing didn't work here. Try Download instead.",
    imageFailed: "Couldn't make the image.",
    cantDraw: "This browser can't draw images.",
    /** Text drawn into the share picture itself. */
    imageSkills: (done: number, total: number) => `${done} of ${total} skills`,
    imageStreak: (weeks: number) => ` · ${weeks}-week streak`,
    imageTraining: (rung: string, streak: string) => `Training at ${rung}${streak}`,
  },
  account: {
    signOut: "Sign out",
    signedInFallback: "Signed in",
  },
  signIn: {
    title: "Sign in",
    body: "Sign in to keep your progress on every device. The app works without an account too.",
    opening: "Opening Google…",
    google: "Continue with Google",
    notNow: "Not now",
    privacy: "What we save and how to delete it",
    notSetUp: "Accounts aren't set up yet.",
    loadFailed: "Couldn't load sign-in. Check your connection and try again.",
  },
  accountDialog: {
    title: "Your account",
    confirmTitle: "Delete your account?",
    confirmBody: "This deletes your account and the progress saved in it, on every device. It can't be undone.",
    browserStays: "Progress saved in this browser stays here. To clear it too, use Reset everything in Settings on each tree.",
    signedInAs: "Signed in with Google as",
    deleting: "Deleting…",
    deleteForGood: "Delete for good",
    cancel: "Cancel",
    delete: "Delete account",
    close: "Close",
    deleteFailed: "Couldn't delete your account. Try again, or email us (see the privacy page).",
    unreachable: "Couldn't reach the server. Check your connection and try again.",
  },
};

/** The shape every language file must have. */
export type Strings = typeof en;
