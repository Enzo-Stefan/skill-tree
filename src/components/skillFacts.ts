import type { Skill, Tree } from "../types";
import { amountFor, skillPassKey, type XpEvent } from "../lib/xp";

/** What passing a skill gives: its XP, and the skills it opens (the ones that list it as a requirement). */
export function skillRewards(tree: Tree, skill: Skill): { xp: number; opens: Skill[] } {
  return {
    xp: amountFor(skillPassKey(skill.id)) ?? 0,
    opens: tree.skills.filter((s) => s.requires.includes(skill.id)),
  };
}

/** The skills this one needs, in the order the tree data lists them. */
export function prerequisites(tree: Tree, skill: Skill): Skill[] {
  return skill.requires.flatMap((id) => tree.skills.filter((s) => s.id === id));
}

/**
 * When the player passed the skill (YYYY-MM-DD, local day), from the XP ledger's pass event, or null when it
 * isn't passed or the ledger has no pass event for it (progress from before XP existed).
 */
export function passedOn(events: XpEvent[], skillId: string): string | null {
  const event = events.find((e) => e.key === skillPassKey(skillId) && e.active);
  if (!event) return null;
  const d = new Date(event.at);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
