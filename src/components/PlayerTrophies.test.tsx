// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Tree } from "../types";
import { ACHIEVEMENTS } from "../data/achievements";
import { en } from "../i18n/en";
import { es } from "../i18n/es";
import { PlayerCard } from "./PlayerCard";
import { PlayerTrophies } from "./PlayerTrophies";

const tree = { branches: [] } as unknown as Tree;
const noRating = { branches: {}, overall: 0 };

afterEach(cleanup);

describe("PlayerTrophies", () => {
  it("shows earned trophies by name, without the hint, and marks them Earned", () => {
    const { container } = render(<PlayerTrophies earned={["first-skill"]} />);
    const earned = container.querySelector(".trophy.earned");
    expect(earned?.textContent).toContain("First skill");
    expect(earned?.textContent).toContain("Earned");
    expect(earned?.textContent).not.toContain("Pass your first skill.");
  });

  it("dims locked trophies, marks them Locked and shows the hint", () => {
    const { container } = render(<PlayerTrophies earned={["first-skill"]} />);
    const locked = [...container.querySelectorAll(".trophy.locked")];
    expect(locked).toHaveLength(ACHIEVEMENTS.length - 1);
    const fiveSkills = locked.find((li) => li.textContent?.includes("Getting going"));
    expect(fiveSkills?.textContent).toContain("Locked");
    expect(fiveSkills?.textContent).toContain("Pass 5 skills.");
  });

  it("counts the earned trophies in the summary", () => {
    render(<PlayerTrophies earned={["first-skill", "expert", "not-a-real-id"]} />);
    expect(screen.getByText(`Trophies 2 / ${ACHIEVEMENTS.length}`)).toBeTruthy();
  });

  it("says so when no trophy is earned yet", () => {
    render(<PlayerTrophies earned={[]} />);
    expect(screen.getByText("No trophies yet. Pass your first skill to earn one.")).toBeTruthy();
    expect(screen.getByText(`Trophies 0 / ${ACHIEVEMENTS.length}`)).toBeTruthy();
  });
});

describe("PlayerCard trophies", () => {
  it("shows the trophies before the first rating, not only after", () => {
    const { container } = render(<PlayerCard tree={tree} ratings={noRating} history={[]} earned={[]} />);
    expect(screen.getByText(/Pass your first skill to see your card/)).toBeTruthy();
    expect(container.querySelector(".player-trophies")).not.toBeNull();
  });

  it("leaves the trophies out when no earned list is given", () => {
    const { container } = render(<PlayerCard tree={tree} ratings={noRating} history={[]} />);
    expect(container.querySelector(".player-trophies")).toBeNull();
  });
});

describe("trophy text", () => {
  it("has a name and hint in both languages for every achievement, with the English matching the rules file", () => {
    for (const a of ACHIEVEMENTS) {
      expect(en.trophyText[a.id as keyof typeof en.trophyText], a.id).toEqual({ title: a.title, text: a.text });
      expect(es.trophyText[a.id as keyof typeof es.trophyText], a.id).toBeDefined();
    }
    expect(Object.keys(es.trophyText).sort()).toEqual(Object.keys(en.trophyText).sort());
  });
});
