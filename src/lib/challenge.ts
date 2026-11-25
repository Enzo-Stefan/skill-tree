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

/** What the share needs from the browser; injectable so the branches can be tested. */
export interface ShareEnv {
  share?: (data: { title: string; text: string }) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
  prompt: (message: string, value: string) => unknown;
}

/**
 * Shares the challenge: the share sheet where there is one, else the clipboard, else a prompt to copy by hand.
 * Cancelling the share sheet does nothing; any other share failure falls back to the clipboard.
 * The prompt can be suppressed in some PWA or embedded contexts, like the copy-link one.
 *
 * Args:
 *   title: The share sheet title.
 *   text: The message to share.
 *   promptTitle: The wording above the text in the prompt fallback.
 *   onCopied: Called after the text reached the clipboard.
 *   env: The browser functions to use.
 */
export async function shareChallenge(
  title: string,
  text: string,
  promptTitle: string,
  onCopied: () => void,
  env: ShareEnv,
): Promise<void> {
  const copy = async () => {
    try {
      if (!env.writeText) throw new Error("no clipboard");
      await env.writeText(text);
      onCopied();
    } catch {
      env.prompt(promptTitle, text);
    }
  };
  if (!env.share) return copy();
  try {
    await env.share({ title, text });
  } catch (e: unknown) {
    // Checked by name: some browsers and webviews reject with a plain Error rather than a DOMException.
    if ((e as { name?: unknown } | null)?.name === "AbortError") return;
    await copy();
  }
}

/** The challenge button shows once the result is saved and the test passed, and only when the app can share. */
export function showChallengeButton(saved: boolean, canChallenge: boolean, phase: string): boolean {
  return saved && canChallenge && phase === "passed";
}
