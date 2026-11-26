// The pool of daily and weekly challenges (#126). Everyone gets the same challenge on the same day: the
// rotation in src/lib/challenges.ts picks from these by date. Adding a challenge is a change to this file only.
//
// What a challenge asks for must be something the app already knows about the player:
//   trainDay          train on the day (a training day is recorded)
//   passSkills        pass this many skills in the period (a skill pass is recorded with its time)
//   trainDays         train on this many different days of the week
//   differentSkills   work on this many different skills in the period (training sessions list the skills)
//
// Ids never change once a challenge has been given: they are part of the XP event key.

export type ChallengeGoal =
  | { kind: "trainDay" }
  | { kind: "passSkills"; count: number }
  | { kind: "trainDays"; count: number }
  | { kind: "differentSkills"; count: number };

export interface Challenge {
  id: string;
  period: "daily" | "weekly";
  goal: ChallengeGoal;
  title: string;
  /** One line for the card. */
  text: string;
}

export const CHALLENGES: Challenge[] = [
  { id: "d-train", period: "daily", goal: { kind: "trainDay" }, title: "Show up", text: "Train today. Any skill counts." },
  { id: "d-pass1", period: "daily", goal: { kind: "passSkills", count: 1 }, title: "Pass one", text: "Pass a skill's test today." },
  { id: "d-focus", period: "daily", goal: { kind: "differentSkills", count: 2 }, title: "Two skills", text: "Work on two different skills today." },
  { id: "d-train2", period: "daily", goal: { kind: "trainDay" }, title: "Keep the ball rolling", text: "Do one training session today." },
  { id: "d-mix", period: "daily", goal: { kind: "differentSkills", count: 3 }, title: "Mix it up", text: "Work on three different skills today." },
  { id: "w-days3", period: "weekly", goal: { kind: "trainDays", count: 3 }, title: "Three days", text: "Train on three different days this week." },
  { id: "w-days4", period: "weekly", goal: { kind: "trainDays", count: 4 }, title: "Four days", text: "Train on four different days this week." },
  { id: "w-pass2", period: "weekly", goal: { kind: "passSkills", count: 2 }, title: "Pass two", text: "Pass two skills this week." },
  { id: "w-skills4", period: "weekly", goal: { kind: "differentSkills", count: 4 }, title: "Well rounded", text: "Work on four different skills this week." },
  { id: "w-pass1", period: "weekly", goal: { kind: "passSkills", count: 1 }, title: "Level up", text: "Pass a skill this week." },
];
