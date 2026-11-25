import { useCallback, useMemo, useState } from "react";
import type { Tree } from "../types";
import type { DayKey } from "../lib/streak";
import { buildWeekPlan, cleanDayMinutes, loadDayMinutes, saveDayMinutes, skillsToPlan, type WeekPlan } from "../lib/plan";

export interface PlanState {
  plan: WeekPlan;
  /** Skills the player added with "Add to my plan". */
  added: string[];
  toggleAdded: (skillId: string) => void;
  dayMinutes: number;
  setDayMinutes: (minutes: number) => void;
  /** Exercises ticked off today, as "<day>|<skill>|<exercise index>", so yesterday's ticks never show today. */
  ticks: Set<string>;
  toggleTick: (key: string) => void;
}

const addedKey = (treeId: string) => `skill-tree:plan-added:${treeId}`;

function loadAdded(treeId: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(addedKey(treeId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveAdded(treeId: string, ids: string[]): void {
  try {
    localStorage.setItem(addedKey(treeId), JSON.stringify(ids));
  } catch {
    // Storage can be blocked. The choice then only lasts for this visit.
  }
}

/** The week's plan for the player's skills, plus what they added to it, their daily limit and today's ticks. */
export function usePlan(tree: Tree, done: Set<string>, levelId: string | null, today: DayKey): PlanState {
  const [added, setAdded] = useState(() => loadAdded(tree.id));
  const [dayMinutes, setMinutes] = useState(loadDayMinutes);
  const [ticks, setTicks] = useState<Set<string>>(() => new Set());

  const plan = useMemo(
    () => buildWeekPlan(skillsToPlan(tree, done, added), levelId, today, dayMinutes),
    [tree, done, added, levelId, today, dayMinutes],
  );

  const toggleAdded = useCallback(
    (skillId: string) =>
      setAdded((prev) => {
        const next = prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId];
        saveAdded(tree.id, next);
        return next;
      }),
    [tree.id],
  );
  const setDayMinutes = useCallback((minutes: number) => {
    const clean = cleanDayMinutes(minutes);
    saveDayMinutes(clean);
    setMinutes(clean);
  }, []);
  const toggleTick = useCallback(
    (key: string) =>
      setTicks((prev) => {
        const next = new Set(prev);
        if (!next.delete(key)) next.add(key);
        return next;
      }),
    [],
  );

  return { plan, added, toggleAdded, dayMinutes, setDayMinutes, ticks, toggleTick };
}
