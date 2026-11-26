// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Skill, Tree } from "../types";
import { TrainingScreen } from "./TrainingScreen";
import type { PlanState } from "./usePlan";

const skill = { id: "s1", name: "Step-over" } as unknown as Skill;
const tree = { id: "t", skills: [skill], branches: [] } as unknown as Tree;
const emptyState = {
  plan: { days: [], unplaced: [] },
  ticks: new Set<string>(),
  restDays: [],
  dayMinutes: 60,
} as unknown as PlanState;

function renderEmpty(props: { allDone: boolean; suggestedName?: string }) {
  const onPickSkill = vi.fn();
  const onOpenProgress = vi.fn();
  render(
    <TrainingScreen
      tree={tree}
      state={emptyState}
      levelId={null}
      today="2026-11-27"
      practiceDays={[]}
      onFinish={vi.fn()}
      onPickSkill={onPickSkill}
      onOpenProgress={onOpenProgress}
      {...props}
    />,
  );
  return { onPickSkill, onOpenProgress };
}

afterEach(cleanup);

describe("TrainingScreen empty state", () => {
  it("says every skill is passed and links to Progress when all are done", () => {
    const { onPickSkill, onOpenProgress } = renderEmpty({ allDone: true });
    expect(screen.getByText("You've passed every skill")).toBeTruthy();
    expect(screen.queryByText(/Pass a skill to unlock/)).toBeNull();
    expect(screen.queryByText("Pick a skill")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "See progress" }));
    expect(onOpenProgress).toHaveBeenCalledTimes(1);
    expect(onPickSkill).not.toHaveBeenCalled();
  });

  it("offers a pick action when skills remain but none is planned", () => {
    const { onPickSkill, onOpenProgress } = renderEmpty({ allDone: false });
    expect(screen.getByText(/Pass a skill to unlock the next ones/)).toBeTruthy();
    expect(screen.queryByText("You've passed every skill")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pick a skill" }));
    expect(onPickSkill).toHaveBeenCalledTimes(1);
    expect(onOpenProgress).not.toHaveBeenCalled();
  });

  it("names the suggested skill on the action when one is available", () => {
    renderEmpty({ allDone: false, suggestedName: "Step-over" });
    expect(screen.getByRole("button", { name: "Start with Step-over" })).toBeTruthy();
  });
});
