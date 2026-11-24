import { useState } from "react";
import type { Tree } from "../types";
import { addLiftEntry, isNewBest, loadLiftLog, removeLiftEntry, saveLiftLog, type LiftEntry } from "../lib/lifts";
import { dayKey } from "../lib/streak";

export interface LoggedLift {
  entry: LiftEntry;
  /** True if this entry beat the player's previous best for the lift. */
  best: boolean;
}

export interface LiftLog {
  log: LiftEntry[];
  /** Logs today's weight for a lift. Returns what was saved, or null if the entry wasn't valid for this tree. */
  add: (skillId: string, kg: number) => LoggedLift | null;
  /** Takes one entry back out, for Undo right after a typo. */
  remove: (entry: LiftEntry) => void;
  /** Empties the log (Reset). */
  clear: () => void;
}

/** The open tree's lift log, kept in React state and saved to the browser on every change. */
export function useLiftLog(tree: Tree): LiftLog {
  const [log, setLog] = useState(() => loadLiftLog(tree));

  function update(next: LiftEntry[]) {
    setLog(next);
    saveLiftLog(tree.id, next);
  }

  return {
    log,
    add(skillId, kg) {
      const entry = { skillId, date: dayKey(new Date()), kg };
      const best = isNewBest(log, entry);
      const next = addLiftEntry(tree, log, entry);
      const saved = next.some((e) => e.skillId === skillId && e.date === entry.date && e.kg === kg);
      if (!saved) return null;
      update(next);
      return { entry, best };
    },
    remove(entry) {
      update(removeLiftEntry(log, entry));
    },
    clear() {
      update([]);
    },
  };
}
