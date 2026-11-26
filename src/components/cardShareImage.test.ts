import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { computeRatings } from "../lib/ratings";
import { cardShareStats } from "./cardShareImage";

const ratings = computeRatings({ tree: football, done: new Set(football.skills.filter((s) => s.branch === "bc").map((s) => s.id)), levelStep: 3 });

describe("cardShareStats", () => {
  it("carries the overall and one rating per branch in the tree's order", () => {
    const stats = cardShareStats(football, ratings, { position: null, foot: null }, "Beginner 3", "example.app");
    expect(stats.overall).toBe(ratings.overall);
    expect(stats.branches.map((b) => b.name)).toEqual(football.branches.map((b) => b.name));
    expect(stats.branches[0]!.value).toBe(ratings.branches[football.branches[0]!.id]);
    expect(stats.levelName).toBe("Beginner 3");
    expect(stats.site).toBe("example.app");
  });

  it("writes position and foot only when they are chosen", () => {
    expect(cardShareStats(football, ratings, { position: null, foot: null }, null, "x").details).toBe("");
    expect(cardShareStats(football, ratings, { position: "MID", foot: null }, null, "x").details).toBe("MID");
    expect(cardShareStats(football, ratings, { position: "MID", foot: "left" }, null, "x").details).toBe("MID · Left foot");
  });
});
