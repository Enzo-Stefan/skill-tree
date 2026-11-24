import { useEffect, useState } from "react";
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
  /** Shows the log loaded from the account, and keeps it in the browser too. */
  replace: (log: LiftEntry[]) => void;
}

/**
 * The open tree's lift log, kept in React state and saved to the browser on every change.
 * Every change starts from what is saved, not from this tab's copy, so two open tabs can't erase
 * each other's entries, and an old tab can't bring entries back after a Reset in another one.
 */
export function useLiftLog(tree: Tree): LiftLog {
  const [log, setLog] = useState(() => loadLiftLog(tree));
  // When the browser blocks saving, the saved log always reads as empty, so changes start from this visit's copy.
  const [canSave] = useState(storageWorks);
  const current = () => (canSave ? loadLiftLog(tree) : log);

  // Another tab saved: show its entries here too. The event only fires in the other tabs.
  useEffect(() => {
    const reload = () => setLog(loadLiftLog(tree));
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, [tree]);

  function update(change: (saved: LiftEntry[]) => LiftEntry[]): LiftEntry[] {
    const next = change(current());
    setLog(next);
    saveLiftLog(tree.id, next);
    return next;
  }

  return {
    log,
    add(skillId, kg) {
      const entry = { skillId, date: dayKey(new Date()), kg };
      const saved = current();
      const next = addLiftEntry(tree, saved, entry);
      if (!next.some((e) => e.skillId === skillId && e.date === entry.date && e.kg === kg)) return null;
      const best = isNewBest(saved, entry);
      update(() => next);
      return { entry, best };
    },
    remove(entry) {
      update((saved) => removeLiftEntry(saved, entry));
    },
    clear() {
      update(() => []);
    },
    replace(next) {
      update(() => next);
    },
  };
}

function storageWorks(): boolean {
  try {
    localStorage.setItem("skill-tree:storage-check", "1");
    localStorage.removeItem("skill-tree:storage-check");
    return true;
  } catch {
    return false;
  }
}
