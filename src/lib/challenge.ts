import { t } from "../i18n";
import type { Better } from "./results";

// "Challenge a mate" (idea 10 in #17): the message a player sends after passing a skill with a
// saved result, with the link to that skill so the mate can open it and try.

/** The wording of the two messages. `time` is already formatted, e.g. "13,2 s". */
export interface ChallengeStrings {
  /** Lower is better (times): "I did the slalom in 13.2 s. Beat it?" */
  lower: (skill: string, time: string) => string;
  /** Higher is better: "I got 14 s on the slalom. Beat it?" */
  higher: (skill: string, time: string) => string;
}

/**
 * The challenge text: the result sentence, then the link on its own line.
 *
 * Args:
 *   skillName: The skill's name.
 *   time: The result already formatted with its unit.
 *   better: Whether lower or higher is the better result (resultDirection in results.ts).
 *   url: The link to the skill.
 *   strings: The wording, in the app's language by default.
 *
 * Returns:
 *   The message to share.
 */
export function challengeText(
  skillName: string,
  time: string,
  better: Better,
  url: string,
  strings: ChallengeStrings = t.challenge,
): string {
  return `${strings[better](skillName, time)}\n${url}`;
}
