// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { football } from "../data/football";
import { completedMissionKeys, exerciseTickKey } from "../lib/missions";
import { usePlan } from "./usePlan";

afterEach(cleanup);

describe("usePlan ticks", () => {
  const today = "2026-11-26";

  it("clearTicks un-ticks everything, so a reset cannot leave today's mission complete", () => {
    const { result } = renderHook(() => usePlan(football, new Set(["root"]), "beginner", today));
    const item = result.current.plan.days.find((d) => d.date === today)!.items[0];
    expect(item).toBeDefined();
    const exercises = football.skills.find((s) => s.id === item!.skillId)!.routine!.exercises;
    act(() => exercises.forEach((_, i) => result.current.toggleTick(exerciseTickKey(today, item!.skillId, i))));
    expect(completedMissionKeys(football, result.current.plan, result.current.ticks, today)).toContain(`mission:${today}:${item!.skillId}`);
    act(() => result.current.clearTicks());
    expect(result.current.ticks.size).toBe(0);
    expect(completedMissionKeys(football, result.current.plan, result.current.ticks, today)).toEqual([]);
  });
});
