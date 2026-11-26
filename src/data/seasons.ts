import type { ChallengeGoal } from "./challenges";

// Seasonal challenges (#121 item 7). A season runs between two dates and has its own set of challenges, so a new season
// only needs a new entry here, with no code change. Each challenge pays XP once (the key is the challenge id and the
// season id). Dates are local calendar days, written YYYY-MM-DD, and both ends are included. Ids never change once given.
//
// The goals use the same kinds as the daily and weekly challenges, counted over the whole season:
//   trainDays        train on this many different days of the season
//   passSkills       pass this many skills during the season
//   differentSkills  work on this many different skills during the season

export interface SeasonChallenge {
  id: string;
  goal: ChallengeGoal;
  title: string;
  text: string;
}

export interface Season {
  id: string;
  title: string;
  /** First day of the season. */
  start: string;
  /** Last day of the season. */
  end: string;
  challenges: SeasonChallenge[];
}

/** Placeholder content for Stefan to rewrite: the first season runs through the winter. */
export const SEASONS: Season[] = [
  {
    id: "winter-2026",
    title: "Winter Grind",
    start: "2026-12-01",
    end: "2027-02-28",
    challenges: [
      { id: "w26-days30", goal: { kind: "trainDays", count: 30 }, title: "Thirty days", text: "Train on 30 different days this season." },
      { id: "w26-pass8", goal: { kind: "passSkills", count: 8 }, title: "Eight new skills", text: "Pass 8 skills this season." },
      { id: "w26-skills12", goal: { kind: "differentSkills", count: 12 }, title: "Twelve skills", text: "Work on 12 different skills this season." },
    ],
  },
];
