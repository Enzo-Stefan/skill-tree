/**
 * Every piece of app text in English, grouped by the screen it appears on.
 *
 * Skill content (drills, tests, tips, rank and level names) is not here: it lives in src/data/.
 * Text with numbers or names in it is a function, so each language can put them where its grammar needs.
 */
export const en = {
  app: {
    showingTargets: (rung: string) => `Showing ${rung} targets.`,
    newRank: (rank: string) => `New rank: ${rank}.`,
    skillCompleteUnlocked: (skill: string, unlocked: string[]) => `${skill} complete. Unlocked: ${unlocked.join(", ")}.`,
    skillComplete: (skill: string) => `${skill} complete.`,
    copied: "Progress copied. Paste it anywhere.",
    copyFailed: "Copy didn't work in this browser.",
    resetDone: "All progress for this tree is reset.",
    accountDeleted: "Your account and its saved progress are deleted.",
    cancel: "Cancel",
    skipForNow: "Skip for now",
  },
  header: {
    skillsCount: (done: number, total: number) => `${done} of ${total} skills`,
    moreToReach: (left: number, rank: string) => `${left} more to reach ${rank}`,
    allUnlocked: "Every skill unlocked.",
    level: (name: string | null) => `Level: ${name ?? "Pick"}`,
    share: "Share my tree",
    copy: "Copy my progress",
    reset: "Reset",
    resetConfirm: "Tap again to reset all",
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
    nodeLabel: (skill: string, state: string) => `${skill}, ${state}`,
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
    youtubeSearch: (skill: string) => `football ${skill} drill tutorial`,
    watchYoutube: "Watch tutorials on YouTube",
    passed: "I passed the test",
    undoFirst: (skills: string[]) => `To undo this, first undo: ${skills.join(", ")}.`,
    undo: "Undo",
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
    intro: "Some tests have a different target for each level. You'll only see yours.",
    lockedHint: "Pass the test to move up",
  },
  levelTest: {
    title: (rung: string) => `${rung} test`,
    intro: (rung: string) => `Do these at the ${rung} targets. Pass them all and you move up to ${rung}.`,
    passed: "I passed",
    notYet: "Not yet",
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
    signIn: "Sign in",
    signOut: "Sign out",
    signedInFallback: "Signed in",
    buttonLabel: (name: string) => `Account: ${name}`,
  },
  signIn: {
    title: "Sign in",
    body: "Sign in to keep your progress on every device. The app works without an account too.",
    opening: "Opening Google…",
    google: "Continue with Google",
    notNow: "Not now",
    notSetUp: "Accounts aren't set up yet.",
    loadFailed: "Couldn't load sign-in. Check your connection and try again.",
  },
  accountDialog: {
    title: "Your account",
    confirmTitle: "Delete your account?",
    confirmBody: "This deletes your account and the progress saved in it, on every device. It can't be undone.",
    browserStays: "Progress saved in this browser stays here. Use Reset if you want to clear it too.",
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
