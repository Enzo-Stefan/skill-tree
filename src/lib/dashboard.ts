import type { Challenge } from "../data/challenges";
import { SEASONS, type Season } from "../data/seasons";
import type { Skill, Tree } from "../types";
import { challengeProgress, dailyChallenge, weeklyChallenge, type ChallengeContext } from "./challenges";
import type { WeekPlan } from "./plan";
import { exerciseTickKey } from "./missions";
import { nextSkill } from "./progress";
import { activeSeason, seasonProgress } from "./seasons";
import type { SessionEntry } from "./sessions";
import type { XpEvent } from "./xp";

// The Train tab's player dashboard (#122): numbers worked out from the progress the app already keeps.

export interface BranchShare {
  id: string;
  name: string;
  color: string;
  done: number;
  total: number;
}

/** Each branch's finished and total skills, in the tree's branch order. Skills with no branch are not counted here. */
export function branchShares(tree: Tree, done: Set<string>): BranchShare[] {
  return tree.branches.map((b) => {
    const skills = tree.skills.filter((s) => s.branch === b.id);
    return { id: b.id, name: b.name, color: b.color, done: skills.filter((s) => done.has(s.id)).length, total: skills.length };
  });
}

export interface SessionStatus {
  skillId: string;
  done: boolean;
}

/** One planned day's sessions, each done once every exercise of its routine is ticked. */
export function daySessions(tree: Tree, plan: WeekPlan, ticks: Set<string>, day: string): SessionStatus[] {
  const planned = plan.days.find((d) => d.date === day);
  if (!planned || planned.rest) return [];
  return planned.items.map((item) => {
    const count = tree.skills.find((s) => s.id === item.skillId)?.routine?.exercises.length ?? 0;
    return { skillId: item.skillId, done: count > 0 && Array.from({ length: count }, (_, i) => ticks.has(exerciseTickKey(day, item.skillId, i))).every(Boolean) };
  });
}

/** How many of the week's planned sessions are done. */
export function weekSessionCount(tree: Tree, plan: WeekPlan, ticks: Set<string>): { done: number; total: number } {
  const all = plan.days.flatMap((d) => daySessions(tree, plan, ticks, d.date));
  return { done: all.filter((s) => s.done).length, total: all.length };
}

export interface RecentItem {
  kind: "session" | "pass";
  date: string;
  skillId: string;
}

/**
 * The latest sessions trained and skills passed, newest first. Passes come from the day markers written when a skill
 * was first passed, so a pass made before the markers existed does not appear. Skills the tree no longer has are left out.
 */
export function recentActivity(tree: Tree, sessions: SessionEntry[], events: XpEvent[], limit = 5): RecentItem[] {
  const known = new Set(tree.skills.map((s) => s.id));
  const items: RecentItem[] = sessions.filter((e) => known.has(e.skillId)).map((e) => ({ kind: "session", date: e.date, skillId: e.skillId }));
  for (const e of events) {
    const m = e.active ? /^passday:(.+):(\d{4}-\d{2}-\d{2})$/.exec(e.key) : null;
    if (m && known.has(m[1]!)) items.push({ kind: "pass", date: m[2]!, skillId: m[1]! });
  }
  // Newest day first; on one day a pass comes before the sessions, then tree order keeps the list stable.
  const order = new Map(tree.skills.map((s, i) => [s.id, i]));
  items.sort((a, b) => b.date.localeCompare(a.date) || (a.kind === b.kind ? 0 : a.kind === "pass" ? -1 : 1) || order.get(a.skillId)! - order.get(b.skillId)!);
  return items.slice(0, limit);
}

export type ContinueTarget = { kind: "session"; skillId: string } | { kind: "skill"; skill: Skill } | null;

/** What "Continue training" opens: today's first unfinished planned session, else the next skill to work on. */
export function continueTarget(tree: Tree, plan: WeekPlan, ticks: Set<string>, done: Set<string>, today: string): ContinueTarget {
  const open = daySessions(tree, plan, ticks, today).find((s) => !s.done);
  if (open) return { kind: "session", skillId: open.skillId };
  const skill = nextSkill(tree, done);
  return skill ? { kind: "skill", skill } : null;
}

export type ChallengeCardKind = "daily" | "weekly" | "season";

export interface ChallengeCard {
  /** The challenge id, which keys its translation. */
  id: string;
  kind: ChallengeCardKind;
  /** The English words; the screen swaps in the player's language by id. */
  title: string;
  text: string;
  have: number;
  need: number;
  done: boolean;
  /** For a season challenge, the season it belongs to. */
  seasonId?: string;
  seasonTitle?: string;
}

/** Today's challenge, this week's challenge, and the active season's challenges, each with progress capped at its goal. */
export function challengeCards(day: string, ctx: ChallengeContext, seasons: Season[] = SEASONS): ChallengeCard[] {
  const card = (c: Challenge): ChallengeCard => {
    const { have, need } = challengeProgress(c, day, ctx);
    return { id: c.id, kind: c.period, title: c.title, text: c.text, have: Math.min(have, need), need, done: have >= need };
  };
  const cards = [card(dailyChallenge(day)), card(weeklyChallenge(day))];
  const season = activeSeason(day, seasons);
  for (const c of season?.challenges ?? []) {
    const { have, need } = seasonProgress(season!, c, ctx);
    cards.push({ id: c.id, kind: "season", title: c.title, text: c.text, have: Math.min(have, need), need, done: have >= need, seasonId: season!.id, seasonTitle: season!.title });
  }
  return cards;
}
