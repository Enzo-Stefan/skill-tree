// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { football } from "../data/football";
import { t } from "../i18n";
import { SkillTree } from "./SkillTree";

afterEach(cleanup);

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
vi.stubGlobal("matchMedia", () => ({ matches: true }));

// The List/Map toggle only exists where the tree is stacked (phones, or a narrow window). Here, phone is on.
function tree() {
  render(
    <SkillTree
      tree={football}
      done={new Set()}
      selectedId=""
      onSelect={vi.fn()}
      branchId={null}
      phone
      nextId={null}
      scrollTo={null}
    />,
  );
}

const list = () => screen.getByRole("button", { name: t.tree.viewList });
const map = () => screen.getByRole("button", { name: t.tree.viewMap });
const zoomGroup = () => screen.queryByRole("group", { name: t.tree.zoomControls });

describe("SkillTree List/Map toggle", () => {
  it("starts on the list, with the list button pressed and no zoom controls", () => {
    tree();
    expect(list().getAttribute("aria-pressed")).toBe("true");
    expect(map().getAttribute("aria-pressed")).toBe("false");
    expect(zoomGroup()).toBeNull();
    expect(screen.getByRole("heading", { name: football.branches[0].name })).toBeTruthy();
  });

  it("switching to Map shows the zoomable map", () => {
    tree();
    fireEvent.click(map());
    expect(map().getAttribute("aria-pressed")).toBe("true");
    expect(list().getAttribute("aria-pressed")).toBe("false");
    expect(zoomGroup()).not.toBeNull();
  });

  it("switching back to List removes the map", () => {
    tree();
    fireEvent.click(map());
    fireEvent.click(list());
    expect(zoomGroup()).toBeNull();
    expect(screen.getByRole("heading", { name: football.branches[0].name })).toBeTruthy();
  });

  it("the group is labelled for screen readers", () => {
    tree();
    expect(screen.getByRole("group", { name: t.tree.viewLabel })).toBeTruthy();
  });

  it("the toggle is absent when the tree is not stacked", () => {
    render(
      <SkillTree tree={football} done={new Set()} selectedId="" onSelect={vi.fn()} branchId={null} phone={false} nextId={null} scrollTo={null} />,
    );
    expect(screen.queryByRole("group", { name: t.tree.viewLabel })).toBeNull();
  });
});
