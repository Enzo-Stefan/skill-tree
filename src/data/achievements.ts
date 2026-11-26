// Achievements and trophies (#121 item 4). A rule here says what earns one; src/lib/achievements.ts checks it.
// Adding an achievement is a change to this file (and its Spanish text in src/i18n/es.ts). Ids never change:
// they are part of the XP event key ("achievement:<id>").

export type AchievementRule =
  /** This many skills passed. */
  | { kind: "skills"; count: number }
  /** Every skill in the tree passed. */
  | { kind: "everySkill" }
  /** This many branches completely passed. */
  | { kind: "branchesComplete"; count: number }
  /** At least one skill passed in every branch. */
  | { kind: "everyBranchTouched" }
  /** This many different days trained. */
  | { kind: "trainDays"; count: number }
  /** A training streak this many weeks long. */
  | { kind: "streakWeeks"; count: number }
  /** A player level picked: 0 Beginner, 1 Intermediate, 2 Advanced, 3 Expert. */
  | { kind: "levelAtLeast"; index: number }
  /** This many test results saved from test mode. */
  | { kind: "results"; count: number };

export interface Achievement {
  id: string;
  title: string;
  text: string;
  rule: AchievementRule;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-skill", title: "First skill", text: "Pass your first skill.", rule: { kind: "skills", count: 1 } },
  { id: "five-skills", title: "Getting going", text: "Pass 5 skills.", rule: { kind: "skills", count: 5 } },
  { id: "ten-skills", title: "On a roll", text: "Pass 10 skills.", rule: { kind: "skills", count: 10 } },
  { id: "twenty-skills", title: "Serious player", text: "Pass 20 skills.", rule: { kind: "skills", count: 20 } },
  { id: "every-skill", title: "Complete player", text: "Pass every skill in the tree.", rule: { kind: "everySkill" } },
  { id: "first-branch", title: "Branch done", text: "Finish a whole branch.", rule: { kind: "branchesComplete", count: 1 } },
  { id: "three-branches", title: "Three branches", text: "Finish three whole branches.", rule: { kind: "branchesComplete", count: 3 } },
  { id: "well-rounded", title: "Well rounded", text: "Pass at least one skill in every branch.", rule: { kind: "everyBranchTouched" } },
  { id: "first-day", title: "First session", text: "Train for the first time.", rule: { kind: "trainDays", count: 1 } },
  { id: "ten-days", title: "Ten days", text: "Train on 10 different days.", rule: { kind: "trainDays", count: 10 } },
  { id: "fifty-days", title: "Fifty days", text: "Train on 50 different days.", rule: { kind: "trainDays", count: 50 } },
  { id: "streak-4", title: "Four-week streak", text: "Train on three days a week for 4 weeks.", rule: { kind: "streakWeeks", count: 4 } },
  { id: "streak-8", title: "Eight-week streak", text: "Keep a training streak for 8 weeks.", rule: { kind: "streakWeeks", count: 8 } },
  { id: "pick-level", title: "Know your level", text: "Pick your player level.", rule: { kind: "levelAtLeast", index: 0 } },
  { id: "intermediate", title: "Intermediate", text: "Reach the Intermediate level.", rule: { kind: "levelAtLeast", index: 1 } },
  { id: "advanced", title: "Advanced", text: "Reach the Advanced level.", rule: { kind: "levelAtLeast", index: 2 } },
  { id: "expert", title: "Expert", text: "Reach the Expert level.", rule: { kind: "levelAtLeast", index: 3 } },
  { id: "first-result", title: "On the clock", text: "Save a test result from test mode.", rule: { kind: "results", count: 1 } },
  { id: "five-results", title: "Tracking progress", text: "Save 5 test results.", rule: { kind: "results", count: 5 } },
  { id: "twenty-results", title: "Data driven", text: "Save 20 test results.", rule: { kind: "results", count: 20 } },
];
