// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { football } from "../data/football";
import { exerciseDifficulty, exerciseMinutes, sessionEstimate } from "../lib/missions";
import { t } from "../i18n";
import { TrainingScreen } from "./TrainingScreen";
import { usePlan } from "./usePlan";

afterEach(cleanup);

describe("estimated time and difficulty on the Training screen (#126 item 2)", () => {
  const today = "2026-11-26";

  function setup() {
    const { result } = renderHook(() => usePlan(football, new Set(["root"]), "beginner", today));
    const day = result.current.plan.days.find((d) => d.date === today)!;
    expect(day.items.length).toBeGreaterThan(0);
    render(<TrainingScreen tree={football} state={result.current} levelId="beginner" today={today} practiceDays={[]} onFinish={() => {}} />);
    return day;
  }

  it("shows one estimate for each session and one for each exercise, worked out from the routine", () => {
    const day = setup();
    const estimates = document.querySelectorAll(".routine-est");
    const exerciseCount = day.items.reduce((n, it) => n + football.skills.find((s) => s.id === it.skillId)!.routine!.exercises.length, 0);
    expect(estimates.length).toBe(day.items.length + exerciseCount);
    const item = day.items[0]!;
    const routine = football.skills.find((s) => s.id === item.skillId)!.routine!;
    const est = sessionEstimate(routine, "beginner", item.heavy);
    expect(screen.getAllByText(t.training.sessionEstimate(est.minutes, t.training.difficulty[est.difficulty])).length).toBeGreaterThan(0);
    const ex = routine.exercises[0]!;
    const minutes = exerciseMinutes(ex, "beginner");
    expect(screen.getAllByText(t.training.estimate(minutes, t.training.difficulty[exerciseDifficulty(minutes)])).length).toBeGreaterThan(0);
  });

  it("only uses the three difficulty words", () => {
    setup();
    const words = new Set(Object.values(t.training.difficulty));
    for (const el of document.querySelectorAll(".routine-est")) {
      expect([...words].some((w) => el.textContent!.endsWith(w))).toBe(true);
    }
  });
});
