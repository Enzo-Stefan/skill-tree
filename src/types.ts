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
  /** Ids of skills that must be done before this one unlocks. */
  requires: string[];
  /** Horizontal slot, 0 to 11 (two slots per branch). */
  x: number;
  /** Tier, 0 at the top. */
  row: number;
  drill: string;
  test: string;
  tip: string;
  /** Draw as a large round node (used for the final skill). */
  big?: boolean;
}

export interface Level {
  /** Number of completed skills needed to reach this level. */
  at: number;
  name: string;
}

export interface Tree {
  id: string;
  title: string;
  tagline: string;
  branches: Branch[];
  skills: Skill[];
  levels: Level[];
}

export type SkillState = "done" | "available" | "locked";
