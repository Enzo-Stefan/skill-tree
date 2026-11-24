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
  test: string;
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
  tagline: string;
  branches: Branch[];
  skills: Skill[];
  /** Ranks earned by completing skills. */
  levels: Level[];
  /** Ability levels the player picks from, easiest first. Optional. */
  playerLevels?: PlayerLevel[];
}

export type SkillState = "done" | "available" | "locked";
