import { useEffect, useState } from "react";
import type { Tree } from "../types";
import { addResult, cleanResults, isNewBestResult, loadResults, removeResult, saveResults, type TestResult } from "../lib/results";
import { dayKey } from "../lib/streak";
import { storageWorks } from "./useLiftLog";

export interface SavedResult {
  result: TestResult;
  /** True if this result beat the player's previous best for the skill. */
  best: boolean;
}

export interface Results {
  results: TestResult[];
  /** Saves today's result for a skill. Returns what was saved, or null if it isn't valid for this tree. */
  add: (skillId: string, value: number) => SavedResult | null;
  /** Takes one result back out, for Undo right after saving. */
  remove: (result: TestResult) => void;
  /** Empties the list (Reset). */
  clear: () => void;
}

/**
 * The open tree's test results (src/lib/results.ts), like the lift log: kept in React state, saved
 * to the browser on every change, and every change starts from what is saved so two open tabs
 * can't erase each other's results. Browser only for now; the account doesn't keep them yet.
 */
export function useResults(tree: Tree): Results {
  const [results, setResults] = useState(() => loadResults(tree));
  // When the browser blocks saving, the saved list always reads as empty, so changes start from this visit's copy.
  const [canSave] = useState(storageWorks);
  const current = () => (canSave ? loadResults(tree) : results);

  useEffect(() => {
    const reload = () => setResults(loadResults(tree));
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, [tree]);

  function update(next: TestResult[]) {
    setResults(next);
    saveResults(tree.id, next);
  }

  return {
    results,
    add(skillId, value) {
      const result = { skillId, date: dayKey(new Date()), value };
      if (cleanResults(tree, [result]).length === 0) return null;
      const saved = current();
      const best = isNewBestResult(tree, saved, result);
      update(addResult(tree, saved, result));
      return { result, best };
    },
    remove(result) {
      update(removeResult(current(), result));
    },
    clear() {
      update([]);
    },
  };
}
