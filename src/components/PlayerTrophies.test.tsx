// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Tree } from "../types";
import { ACHIEVEMENTS } from "../data/achievements";
import { en } from "../i18n/en";
import { es } from "../i18n/es";
import { t } from "../i18n";
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

  it("is open when at least one trophy is earned", () => {
    const { container } = render(<PlayerTrophies earned={["first-skill"]} />);
    expect(container.querySelector("details")?.open).toBe(true);
  });

  it("draws nothing until a trophy is earned, and ignores ids that are not achievements", () => {
    expect(render(<PlayerTrophies earned={[]} />).container.firstChild).toBeNull();
    cleanup();
    expect(render(<PlayerTrophies earned={["not-a-real-id"]} />).container.firstChild).toBeNull();
  });

  it("keeps the player's choice to close it when another trophy is earned", () => {
    const { container, rerender } = render(<PlayerTrophies earned={["first-skill"]} />);
    const details = container.querySelector("details")!;
    details.open = false;
    rerender(<PlayerTrophies earned={["first-skill", "expert"]} />);
    expect(container.querySelector("details")).toBe(details);
    expect(details.open).toBe(false);
  });

  it("makes the summary a 44px target in the stylesheet", () => {
    const css = readFileSync("src/index.css", "utf8");
    expect(css).toMatch(/\.player-trophies summary\s*\{[^}]*min-height:\s*44px/);
  });

  it("falls back to the data file's text for an achievement with no translation", () => {
    const names = t.trophyText as Partial<Record<string, { title: string; text: string }>>;
    const saved = names["first-skill"];
    delete names["first-skill"];
    try {
      const { container } = render(<PlayerTrophies earned={["expert"]} />);
      const li = [...container.querySelectorAll(".trophy.locked")].find((el) => el.textContent?.includes("Pass your first skill."));
      expect(li, "falls back to the data text").toBeTruthy();
      expect(li?.textContent).toContain(ACHIEVEMENTS[0].title);
    } finally {
      names["first-skill"] = saved;
    }
  });
});

describe("PlayerCard trophies", () => {
  const base = { tree, ratings: noRating, history: [], hasProgress: false };

  it("leaves the trophies out while nothing is earned, even with an earned list", () => {
    const { container } = render(<PlayerCard {...base} earned={[]} />);
    expect(screen.getByText(/Pass your first skill to see your card/)).toBeTruthy();
    expect(container.querySelector(".player-trophies")).toBeNull();
  });

  it("shows them after the ratings and the pickers once one is earned", () => {
    const { container } = render(<PlayerCard {...base} hasProgress ratings={{ branches: {}, overall: 10 }} card={{ position: null, foot: null }} onCardChange={() => {}} earned={["first-skill"]} />);
    const ratings = container.querySelector(".player-overall")!;
    const picks = container.querySelector(".player-picks")!;
    const trophies = container.querySelector(".player-trophies")!;
    expect(ratings.compareDocumentPosition(trophies) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(picks.compareDocumentPosition(trophies) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("leaves the trophies out when no earned list is given", () => {
    const { container } = render(<PlayerCard {...base} />);
    expect(container.querySelector(".player-trophies")).toBeNull();
  });
});

describe("trophy text", () => {
  it("has a Spanish name and hint for exactly the achievements in the data file", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id).sort();
    expect(Object.keys(es.trophyText).sort()).toEqual(ids);
  });

  it("takes the English name and hint from the data file", () => {
    for (const a of ACHIEVEMENTS) {
      expect(en.trophyText[a.id], a.id).toEqual({ title: a.title, text: a.text });
    }
    expect(Object.keys(en.trophyText).sort()).toEqual(ACHIEVEMENTS.map((a) => a.id).sort());
  });
});
