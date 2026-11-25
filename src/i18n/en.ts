import { formatNumber } from "../lib/progress";

/**
 * Every piece of app text in English, grouped by the screen it appears on.
 *
 * Skill content (drills, tests, tips, rank and level names) is not here: it lives in src/data/.
 * Text with numbers or names in it is a function, so each language can put them where its grammar needs.
 */
/** A number written the English way: "5.8". */
function num(n: number): string {
  return formatNumber(n, "en");
}

/** "A" or "A and B". */
function listAnd(items: string[]): string {
  return items.join(" and ");
}

export const en = {
  app: {
    train: "Train",
    showingTargets: (rung: string) => `Showing ${rung} targets.`,
    linkCopied: "Link copied.",
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
    areas: "Areas",
    plan: "Training",
    progress: "Progress",
    settings: "Settings",
  },
  training: {
    today: "Today",
    week: "Week",
    views: "Training view",
    restDay: "Nothing planned today. Rest up.",
    noPlan: "No skills to train yet. Pass a skill to unlock the next ones, or add one to your plan from its sheet.",
    sessionOf: (skill: string, minutes: number) => `${skill} · ${minutes} min`,
    warmUp: "Warm-up",
    coolDown: "Cool-down",
    exercises: "Exercises",
    setsReps: (sets: number, reps: number) => `${sets} × ${reps} reps`,
    /** "3 × 20 min": several sets of something. */
    setsOf: (sets: number, what: string) => `${sets} × ${what}`,
    /** Sets of a single rep, e.g. rounds of a circuit: "2 sets". */
    setsOnly: (sets: number) => `${sets} sets`,
    /** One set: "8 reps". */
    repsOnly: (reps: number) => `${reps} ${reps === 1 ? "rep" : "reps"}`,
    rest: (duration: string) => `Rest ${duration}`,
    startRest: (duration: string) => `Start ${duration} rest`,
    restRunning: (left: number) => `Rest: ${left} s`,
    restOver: "Rest over. Next set.",
    skipRest: "Skip rest",
    finish: "Finish session",
    finished: "Session finished. Counted as a training day.",
    finishedToday: "Done for today",
    progress: (done: number, total: number) => `${done} of ${total} exercises done`,
    restDays: "Rest days",
    dayLimit: "Most training per day",
    minutes: (n: number) => `${n} min`,
    lessTime: "Less time per day",
    moreTime: "More time per day",
    unplaced: (n: number) => `${n} ${n === 1 ? "session doesn't" : "sessions don't"} fit under your daily limit. Raise it to fit more.`,
    dayDone: "Trained",
    dayRest: "Rest",
    routine: "Routine",
    routineFacts: (sessions: number, minutes: number) => `${sessions}× a week · ${minutes} min a session`,
    addToPlan: "Add to my plan",
    removeFromPlan: "Remove from my plan",
    inPlan: "In your plan: it's unlocked and not passed yet.",
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
    thisWeek: "This week",
    streak: "Streak",
    yourLevel: "Your level",
    noLevel: "Pick your level to see your targets and train toward the level test.",
    pickLevel: "Pick your level",
    step: (step: number, total: number) => `Step ${step} of ${total}`,
    /** "Streak: <2 of 4 weeks> toward the level test" */
    weeksOf: (weeks: number, goal: number) => `${weeks} of ${goal} weeks`,
    towardTest: "toward the level test",
    daysOf: (done: number, goal: number) => `${done} of ${goal} days`,
    daysLeft: (n: number) => `${n} more ${n === 1 ? "day" : "days"} this week to count it toward your streak.`,
    weekCounts: "This week counts toward your streak.",
    weekAfterMove: "You changed level this week, so your streak starts again next week.",
    /** For screen readers, one per day: "Monday: trained (today)". */
    dayLabel: (day: string, trained: boolean, today: boolean) =>
      `${day}: ${trained ? "trained" : "not trained"}${today ? " (today)" : ""}`,
    branches: "Branches",
    branchCount: (done: number, total: number) => `${done} of ${total}`,
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
    feedback: "Send feedback",
    feedbackSub: "Ideas, bugs or a skill that's too hard",
    feedbackSubject: "hapi skill feedback",
    videos: "Videos",
    videosSub: "From creators on YouTube. Each video belongs to its channel, which the player shows.",
    version: "Version",
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
  areas: {
    title: "Areas",
    hint: "Pick what to train. Choosing one opens its skills.",
    branches: (name: string) => `${name} branches`,
    /** The small pill at the top of Train that opens this page. */
    change: (name: string) => `${name}. Change area`,
  },
  treeSwitch: {
    label: "Skill tree",
    /** On the pill of a tree that isn't built yet. */
    soon: "Coming soon",
    soonLabel: (name: string) => `${name}, coming soon`,
  },
  branchTabs: {
    label: "Branches",
    /** The pill that shows the whole tree. */
    all: "All",
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
    copyLink: "Copy link to this skill",
    finalSkill: "Final skill",
    close: "Close",
    closeLabel: "Close skill details",
    /** The phone sheet's grabber, for screen readers: it switches between half and full height. */
    showAll: "Show the whole skill",
    showLess: "Show less",
    /** Under the test's buttons in the half-height sheet: opens the rest. */
    showMore: (hasVideo: boolean, swipe: boolean): string =>
      `${swipe ? "Swipe up for" : "Show"} ${hasVideo ? "the drill, video and tip" : "the drill and tip"}`,
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
      s < 60 ? `${num(s)} seconds` : s % 60 === 0 ? `${s / 60} minutes` : `${Math.floor(s / 60)} min ${num(s % 60)} s`,
    bestOf: (n: number) => `Best of ${n} runs.`,
    everyRun: (n: number) => `${n} runs, every one under the time.`,
    eachTry: (seconds: number) =>
      `Each try lasts ${num(seconds)} seconds. Tap Start for each try, and Miss if it goes wrong. Lasting the whole time counts as a hit.`,
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
    startTry: "Start try",
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
    /** A saved time, e.g. "5.61 s". */
    seconds: (value: number) => `${num(value)} s`,
    saveTime: (time: string) => `Save my time: ${time}`,
    saved: (time: string) => `Saved ${time}.`,
    newBest: (time: string) => `New best time: ${time}!`,
    undoSave: "Undo",
    /** In the skill sheet, above the saved best time. */
    bestTime: "Your best time",
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
    /** Friday and Saturday, while the week's goal is still within reach. */
    nudge: (n: number) =>
      n === 1 ? "1 more day this week keeps your streak growing." : `${n} more days this week keep your streak growing.`,
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
    welcomeTitle: "Don't lose your progress",
    welcomeBody: "Sign in with Google to keep your progress on every device.",
    skip: "Skip",
    skipWarning: "If you skip, your progress is only saved in this browser. Clearing your browser data or switching devices will lose it.",
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
  /** Account sync messages (src/lib/useCloudSync.ts). */
  sync: {
    signedIn: "Signed in. Your progress is saved to your account.",
    saveFailed: "Couldn't save to your account. Your progress is still saved on this device.",
    loadFailed: "Couldn't reach your account. Your progress is still saved on this device.",
  },
  /** The "Copy my progress" text (progressSummary in src/lib/progress.ts). */
  summary: {
    headline: (title: string, done: number, total: number, rank: string) => `My ${title}: ${done}/${total} skills, rank ${rank}.`,
    training: (rung: string) => ` Training at ${rung}.`,
  },
};

/** The shape every language file must have. */
export type Strings = typeof en;
