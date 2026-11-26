import { SEASONS, type Season, type SeasonChallenge } from "../data/seasons";
import type { ChallengeContext } from "./challenges";
import { challengeKey } from "./xp";

// Seasonal challenges (#121 item 7): a challenge set with a start and an end date, from src/data/seasons.ts.

/** The season a day falls in (both ends included), or null between seasons. If seasons overlap, the one that started last. */
export function activeSeason(day: string, seasons: Season[] = SEASONS): Season | null {
  const inside = seasons.filter((s) => s.start <= day && day <= s.end);
  return inside.sort((a, b) => b.start.localeCompare(a.start))[0] ?? null;
}

/** What the player has done toward a seasonal challenge between the season's first and last day, and what it asks for. */
export function seasonProgress(season: Season, challenge: SeasonChallenge, ctx: ChallengeContext): { have: number; need: number } {
  const inside = (d: string) => season.start <= d && d <= season.end;
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

export function seasonChallengeDone(season: Season, challenge: SeasonChallenge, ctx: ChallengeContext): boolean {
  const { have, need } = seasonProgress(season, challenge, ctx);
  return have >= need;
}

/** The XP event key for a seasonal challenge: one award per challenge and season. */
export function seasonAwardKey(season: Season, challenge: SeasonChallenge): string {
  return challengeKey(challenge.id, `season-${season.id}`);
}
