// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Tree } from "../types";
import type { XpState } from "../lib/useXp";
import { ProgressScreen } from "./ProgressScreen";

const tree = { title: "Football", branches: [], skills: [], levels: [{ name: "Rookie", at: 0 }] } as unknown as Tree;
const xp = { total: 10, level: { level: 1, into: 0, span: 100, progress: 0 }, earned: ["first-skill"] } as unknown as XpState;
const base = {
  tree,
  done: new Set<string>(),
  playerLevelName: null,
  playerStep: 1,
  levelTestAhead: false,
  practiceDays: [],
  today: "2026-11-26",
  daysThisWeek: 0,
  weekCanCount: true,
  streakWeeks: 0,
  liftLog: [],
  onShare: () => {},
  hasProgress: true,
  xp,
} as unknown as Parameters<typeof ProgressScreen>[0];

afterEach(cleanup);

/** Counts the places that print "Trophies n / total". */
function countLines(container: HTMLElement): number {
  return [...container.querySelectorAll("p, summary")].filter((el) => /^Trophies \d+ \/ \d+$/.test(el.textContent ?? "")).length;
}

describe("ProgressScreen trophy count", () => {
  it("prints one trophy count line with the player card", () => {
    const { container } = render(<ProgressScreen {...base} ratings={{ branches: {}, overall: 10 }} ratingHistory={[]} />);
    expect(countLines(container)).toBe(1);
  });

  it("prints one trophy count line without ratings", () => {
    const { container } = render(<ProgressScreen {...base} />);
    expect(countLines(container)).toBe(1);
  });
});
