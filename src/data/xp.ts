// How much XP each kind of event is worth, and the steps of the XP level. Tuning the game is a change to
// this file only. An award stores the amount it was given (src/lib/xp.ts), so changing a number here
// never changes what players already earned.

/** What an event key starts with, and what it is worth. See the key builders in src/lib/xp.ts. */
export const XP_AMOUNTS = {
  /** Passing a skill's test. */
  skill: 100,
  /** Completing a training session (a day trained). */
  session: 40,
  /** A daily challenge. */
  challengeDaily: 30,
  /** A weekly challenge. */
  challengeWeekly: 100,
  /** Passing a skill's test again at a higher step, by mastery tier. */
  mastery: { bronze: 50, silver: 100, gold: 150 },
  /** A bonus at a streak milestone, by the number of weeks. */
  streak: { 4: 200, 8: 400, 12: 600 } as Record<number, number>,
  /** An achievement can carry XP too. Zero until the list exists (#121 item 4). */
  achievement: 0,
} as const;

/** XP needed to reach level n is XP_LEVEL_STEP * (n - 1)^2: level 2 at 100, level 3 at 400, level 10 at 8100. */
export const XP_LEVEL_STEP = 100;
