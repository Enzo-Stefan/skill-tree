// The shared contract between the data/logic side and the UI side.
// Change this file only after both of you agree.

export interface Branch {
  id: string;
  name: string;
  color: string;
}

export interface Skill {
  id: string;
  /** Branch id, or null for the start and final skills. */
  branch: string | null;
  name: string;
  /**
   * A lift: when the player passes it, they enter the weight they used, and the app keeps
   * their personal best (see src/lib/lifts.ts). Used by the weight training tree.
   */
  logWeight?: boolean;
  /** Ids of skills that must be done before this one unlocks. */
  requires: string[];
  /** Horizontal slot, 0 to 11 (two slots per branch). */
  x: number;
  /** Tier, 0 at the top. */
  row: number;
  drill: string;
  /**
   * A video of the drill: a YouTube link (watch, youtu.be or shorts) or a direct link
   * to a video file (.mp4, .webm, .mov). Replace it with our own video by changing the link.
   * Without one, the panel links to a YouTube search instead.
   */
  video?: string;
  test: string;
  /** How the test is checked at the pitch, so the app can count or time it (idea 4 in #17). */
  check?: TestCheck;
  tip: string;
  /**
   * Per-level targets for this skill's test. When set, the player sees only the target
   * for their own level and step.
   */
  targets?: Targets;
  /** Draw as a large round node (used for the final skill). */
  big?: boolean;
}

/**
 * How a skill's test is checked, for a test mode with counters and timers. The numbers mirror the
 * test sentence, and validateTree checks they appear in it.
 *
 * - `hits`: `needed` of `attempts` go right, e.g. "8 of 10 passes hit the zone". Hit and Miss buttons.
 *   `seconds` is how long each attempt lasts when it's timed ("keep the ball for 10 seconds").
 * - `count`: reach `needed`, e.g. "20 juggles", "12 reps". With `inARow`, a miss starts the count
 *   again ("20 juggles in a row"). With `seconds`, inside that time: "40 passes in 60 seconds"
 *   counts down from 60.
 * - `time`: a stopwatch. Finish `under` seconds; without `under`, the level target is the limit.
 *   `tries`: the best of that many counts ("best of 3"). `reps`: every one of that many must be under.
 * - `hold`: hold a position for `seconds`, e.g. a plank. A countdown.
 * - `done`: no counter or timer, the player just says they did it ("Run 3 km", "play a full match").
 *
 * `perSide`: do it on each side or leg, so the test runs twice.
 */
export type TestCheck =
  | { kind: "hits"; needed: number; attempts: number; seconds?: number; perSide?: boolean }
  | { kind: "count"; needed: number; inARow?: boolean; seconds?: number; perSide?: boolean }
  | { kind: "time"; under?: number; tries?: number; reps?: number; perSide?: boolean }
  | { kind: "hold"; seconds: number; perSide?: boolean }
  | { kind: "done" };

/**
 * A skill's test targets as numbers, so the steps inside each level can be worked out.
 * Each level has 4 steps. Step 1 is the level's own number, steps 2 to 4 sit evenly
 * between it and the next level's number. The top level keeps going at the same pace.
 */
export interface Targets {
  /** The target sentence with `{n}` where the number goes, e.g. "Under {n} seconds." */
  text: string;
  /** The number at step 1 of each level, keyed by PlayerLevel id. One for every level. */
  values: Record<string, number>;
}

/** How good the player already is. They pick one, and it sets which targets they see. */
export interface PlayerLevel {
  id: string;
  name: string;
  /** One line to help players choose, e.g. "New to the sport". */
  hint: string;
}

/** A rank earned by completing skills, e.g. Sunday League or Pro. */
export interface Level {
  /** Number of completed skills needed to reach this rank. */
  at: number;
  name: string;
}

export interface Tree {
  id: string;
  title: string;
  /** Short name for the tree switch, e.g. "Football". Falls back to the title. */
  shortName?: string;
  tagline: string;
  branches: Branch[];
  skills: Skill[];
  /** Ranks earned by completing skills. */
  levels: Level[];
  /** Ability levels the player picks from, easiest first. Optional. */
  playerLevels?: PlayerLevel[];
}

export type SkillState = "done" | "available" | "locked";
