// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { football } from "../data/football";
import { t } from "../i18n";
import { SkillPage } from "./SkillPage";

afterEach(cleanup);

// bc4 has prerequisites in the football tree.
const skill = football.skills.find((s) => s.id === "bc4")!;
const prereqs = skill.requires.map((id) => football.skills.find((s) => s.id === id)!);

function page(over: { onBack?: () => void; onOpen?: (id: string) => void; done?: Set<string> } = {}) {
  const onBack = over.onBack ?? vi.fn();
  const onOpen = over.onOpen ?? vi.fn();
  render(
    <SkillPage
      tree={football}
      done={over.done ?? new Set()}
      skill={skill}
      results={[]}
      sessions={[]}
      xpEvents={[]}
      onOpen={onOpen}
      onBack={onBack}
    >
      <p>panel actions</p>
    </SkillPage>,
  );
  return { onBack, onOpen };
}

describe("SkillPage", () => {
  it("renders the skill name as the page heading", () => {
    page();
    expect(screen.getByRole("heading", { level: 1, name: skill.name })).toBeTruthy();
  });

  it("lists each prerequisite by name", () => {
    page();
    expect(prereqs.length).toBeGreaterThan(0);
    for (const p of prereqs) expect(screen.getByText(p.name)).toBeTruthy();
    expect(screen.getByRole("heading", { name: t.skillPage.needs })).toBeTruthy();
  });

  it("says when there are no prerequisites", () => {
    const start = football.skills.find((s) => s.requires.length === 0)!;
    render(
      <SkillPage tree={football} done={new Set()} skill={start} results={[]} sessions={[]} xpEvents={[]} onOpen={vi.fn()} onBack={vi.fn()}>
        <p>panel actions</p>
      </SkillPage>,
    );
    expect(screen.getByText(t.skillPage.needsNone)).toBeTruthy();
  });

  it("the back button calls onBack", () => {
    const { onBack } = page();
    fireEvent.click(screen.getByRole("button", { name: t.skillPage.back }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("opening a prerequisite calls onOpen with its id", () => {
    const { onOpen } = page();
    fireEvent.click(screen.getByText(prereqs[0].name));
    expect(onOpen).toHaveBeenCalledWith(prereqs[0].id);
  });

  it("renders the children (the skill's own panel)", () => {
    page();
    expect(screen.getByText("panel actions")).toBeTruthy();
  });
});
