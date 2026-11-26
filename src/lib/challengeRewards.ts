import type { Challenge } from "../data/challenges";
import type { Season } from "../data/seasons";
import { SEASONS } from "../data/seasons";
import { challengeAwardKey, challengeDone, dailyChallenge, weeklyChallenge, type ChallengeContext } from "./challenges";
import type { SessionEntry } from "./sessions";
import { activeSeason, seasonAwardKey, seasonChallengeDone } from "./seasons";
import { dayKey } from "./streak";
import { amountFor, award, type XpEvent } from "./xp";

// Awards the XP for today's daily challenge, this week's weekly challenge, and the current season's challenges
// (#126 item 5, #121 item 7) when the player has done what they ask. One award per challenge and period (the key
// is the challenge id and the day, the week's Monday, or the season), so it pays once however often this runs.
// Only the current period is looked at: a challenge missed yesterday cannot be earned today.

/** The days skills were passed on: the time of each active skill-pass event, as the player's local day. */
export function passDaysFromLedger(events: XpEvent[]): string[] {
  return events.filter((e) => e.active && /^skill:.+:pass$/.test(e.key)).map((e) => dayKey(new Date(e.at)));
}

export interface ChallengeInput {
  practiceDays: string[];
  sessions: SessionEntry[];
  today: string;
}

/** The ledger with the XP for every challenge done in today's day, week and season. */
export function applyChallengeRewards(events: XpEvent[], input: ChallengeInput, now: string, seasons: Season[] = SEASONS): XpEvent[] {
  const ctx: ChallengeContext = { practiceDays: input.practiceDays, sessions: input.sessions, passDays: passDaysFromLedger(events) };
  let next = events;
  const grant = (challenge: Challenge) => {
    if (!challengeDone(challenge, input.today, ctx)) return;
    const key = challengeAwardKey(challenge, input.today);
    next = award(next, key, amountFor(key, challenge.period === "weekly"), now);
  };
  grant(dailyChallenge(input.today));
  grant(weeklyChallenge(input.today));
  const season = activeSeason(input.today, seasons);
  if (season) {
    for (const challenge of season.challenges) {
      if (!seasonChallengeDone(season, challenge, ctx)) continue;
      const key = seasonAwardKey(season, challenge);
      next = award(next, key, amountFor(key), now);
    }
  }
  return next;
}

/** The ledger with the XP for each mission key given (see completedMissionKeys). Awarding twice pays once. */
export function applyMissionRewards(events: XpEvent[], missionKeys: string[], now: string): XpEvent[] {
  let next = events;
  for (const key of missionKeys) next = award(next, key, amountFor(key), now);
  return next;
}
