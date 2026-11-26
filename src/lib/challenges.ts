import { CHALLENGES, type Challenge } from "../data/challenges";
import type { SessionEntry } from "./sessions";
import { weekOf, type DayKey, type WeekKey } from "./streak";
import { challengeKey } from "./xp";

// The daily and weekly challenge (#126). The pick depends only on the date, so everyone gets the same
// challenge on the same day, with no server. The same day never gives two different answers, and the
// next day or week is never the same challenge as this one.

/** A small, fixed string hash (FNV-1a), so the pick is the same on every device and in every browser. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small seeded random number generator (mulberry32). */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whole days since 1970-01-01 for a local calendar day, the same wherever the clock is (no time zone or DST). */
function dayNumber(day: DayKey): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** The whole pool in an order that depends only on the round number. */
function shuffled(pool: Challenge[], kind: string, round: number): Challenge[] {
  const rand = random(hash(`${kind}:${round}`));
  const order = [...pool];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/**
 * The challenge for period number n (a day number, or a week number). The pool is dealt out in a shuffled
 * order, round after round, so every challenge comes round before any repeats. The first of a round is swapped
 * with the second when it would repeat the last of the round before, so the same challenge never comes twice
 * in a row. Both rounds are worked out from n alone, with no stored state. A pool of one or two just alternates.
 */
function pick(pool: Challenge[], kind: string, n: number): Challenge {
  const size = pool.length;
  if (size < 3) return pool[((n % size) + size) % size]!;
  const round = Math.floor(n / size);
  const position = ((n % size) + size) % size;
  const order = shuffled(pool, kind, round);
  const previousLast = shuffled(pool, kind, round - 1)[size - 1]!;
  if (order[0] === previousLast) [order[0], order[1]] = [order[1]!, order[0]!];
  return order[position]!;
}

const daily = CHALLENGES.filter((c) => c.period === "daily");
const weekly = CHALLENGES.filter((c) => c.period === "weekly");

/** Today's challenge. */
export function dailyChallenge(day: DayKey, pool: Challenge[] = daily): Challenge {
  return pick(pool, "daily", dayNumber(day));
}

/** The challenge for the week that contains `day`. */
export function weeklyChallenge(day: DayKey, pool: Challenge[] = weekly): Challenge {
  // 1970-01-05 was a Monday, so weeks are counted from there.
  return pick(pool, "weekly", Math.floor((dayNumber(weekOf(day)) - 4) / 7));
}

/** The day (daily) or the week's Monday (weekly) a challenge belongs to: the second part of its XP key. */
export function periodOf(challenge: Challenge, day: DayKey): DayKey | WeekKey {
  return challenge.period === "weekly" ? weekOf(day) : day;
}

/** The XP event key for finishing a challenge in the period `day` falls in. */
export function challengeAwardKey(challenge: Challenge, day: DayKey): string {
  return challengeKey(challenge.id, periodOf(challenge, day));
}

// ---- Checking a challenge ----

export interface ChallengeContext {
  /** Days the player trained. */
  practiceDays: DayKey[];
  /** Which skills were worked on which day (src/lib/sessions.ts). */
  sessions: SessionEntry[];
  /** The days skills were passed on: the time of each active skill-pass event, as a day. */
  passDays: DayKey[];
}

const inPeriod = (challenge: Challenge, day: DayKey) => (d: DayKey) => (challenge.period === "weekly" ? weekOf(d) === weekOf(day) : d === day);

/** What the player has done toward a challenge, and what it asks for. */
export function challengeProgress(challenge: Challenge, day: DayKey, ctx: ChallengeContext): { have: number; need: number } {
  const inside = inPeriod(challenge, day);
  const g = challenge.goal;
  switch (g.kind) {
    case "trainDay":
      return { have: ctx.practiceDays.some(inside) ? 1 : 0, need: 1 };
    case "trainDays":
      return { have: new Set(ctx.practiceDays.filter(inside)).size, need: g.count };
    case "passSkills":
      return { have: ctx.passDays.filter(inside).length, need: g.count };
    case "differentSkills":
      return { have: new Set(ctx.sessions.filter((e) => inside(e.date)).map((e) => e.skillId)).size, need: g.count };
  }
}

export function challengeDone(challenge: Challenge, day: DayKey, ctx: ChallengeContext): boolean {
  const { have, need } = challengeProgress(challenge, day, ctx);
  return have >= need;
}
