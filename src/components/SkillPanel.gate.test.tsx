// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { football } from "../data/football";
import { t } from "../i18n";
import { SkillPanel } from "./SkillPanel";

afterEach(cleanup);

function panel(skillId: string, over: { done?: Set<string>; onComplete?: (id: string) => void } = {}) {
  const skill = football.skills.find((s) => s.id === skillId)!;
  const done = over.done ?? new Set(skill.requires);
  const onComplete = over.onComplete ?? vi.fn();
  render(
    <SkillPanel
      tree={football}
      done={done}
      skillId={skillId}
      onComplete={onComplete}
      onUndo={vi.fn()}
      playerLevelName="Beginner 1"
      target={null}
      onChangeLevel={vi.fn()}
    />,
  );
  return onComplete;
}

const passedButton = () => screen.queryByRole("button", { name: t.panel.passed });

describe("SkillPanel test gating", () => {
  it("keeps the plain 'I passed' button on an easy skill", () => {
    panel("bc1");
    expect(passedButton()).not.toBeNull();
    expect(screen.queryByText(t.panel.testRequired)).toBeNull();
  });

  it("replaces it with a hint on an advanced skill, and still offers the test", () => {
    panel("bc4");
    expect(passedButton()).toBeNull();
    expect(screen.getByText(t.panel.testRequired)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: new RegExp(t.testMode.start, "i") }).length).toBeGreaterThan(0);
  });

  it("keeps the plain button on an advanced skill whose check has no counter or timer", () => {
    // df1 is a 'done' check on a low tier; ft1 too. The final skill is a 'done' check at the top.
    panel("final", { done: new Set(football.skills.filter((s) => s.id !== "final").map((s) => s.id)) });
    expect(passedButton()).not.toBeNull();
  });

  it("still lets a player undo an advanced skill they already passed", () => {
    const skill = football.skills.find((s) => s.id === "bc4")!;
    panel("bc4", { done: new Set([...skill.requires, "bc4"]) });
    expect(screen.getByRole("button", { name: t.panel.undo })).toBeTruthy();
    expect(screen.queryByText(t.panel.testRequired)).toBeNull();
  });
});
