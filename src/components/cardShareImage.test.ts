import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { computeRatings } from "../lib/ratings";
import { es } from "../i18n/es";
import { en } from "../i18n/en";
import { cardShareStats, drawCardImage, type CardShareStats } from "./cardShareImage";
import { SHARE_WIDTH } from "./shareImage";

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
    expect(cardShareStats(football, ratings, { position: null, foot: "right" }, null, "x").details).toBe("Right foot");
    expect(cardShareStats(football, ratings, { position: null, foot: "both" }, null, "x").details).toBe("Both feet");
  });

  it("writes the foot in Spanish, and differently from English", () => {
    expect(es.playerCard.footLabel.both).toBe("Ambos pies");
    expect(es.playerCard.footLabel.left).toBe("Pie izquierdo");
    expect(es.playerCard.footLabel.right).toBe("Pie derecho");
    for (const foot of ["left", "right", "both"] as const) {
      expect(es.playerCard.footLabel[foot]).not.toBe(en.playerCard.footLabel[foot]);
    }
  });
});

interface Drawn {
  text: string;
  x: number;
  font: string;
}

/** A 2D context whose text width is 0.6 em per character at the font size currently set, so shrinking is visible. */
function mockContext() {
  const drawn: Drawn[] = [];
  const ctx = {
    fillStyle: "",
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    fillRect() {},
    createRadialGradient() {
      return { addColorStop() {} };
    },
    measureText(text: string) {
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 10);
      return { width: Array.from(text).length * px * 0.6 };
    },
    fillText(text: string, x: number) {
      drawn.push({ text, x, font: ctx.font });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, drawn, raw: ctx };
}

function widthOf(raw: ReturnType<typeof mockContext>["raw"], d: Drawn): number {
  raw.font = d.font;
  return raw.measureText(d.text).width;
}

function sampleStats(overrides: Partial<CardShareStats> = {}): CardShareStats {
  return {
    title: "Football",
    levelName: "Beginner 3",
    details: "MID · Left foot",
    overall: 72,
    branches: [
      { name: "Passing", color: "#3b82f6", value: 80 },
      { name: "Shooting", color: "#ef4444", value: 45 },
    ],
    site: "example.app",
    ...overrides,
  };
}

describe("drawCardImage", () => {
  it("draws the overall, each branch name and its value", () => {
    const { ctx, drawn } = mockContext();
    drawCardImage(ctx, sampleStats());
    const texts = drawn.map((d) => d.text);
    expect(texts).toContain("72");
    expect(texts).toContain("PASSING");
    expect(texts).toContain("80");
    expect(texts).toContain("SHOOTING");
    expect(texts).toContain("45");
    expect(texts).toContain("Beginner 3 · MID · Left foot");
  });

  it("keeps a very long title and branch name inside the canvas margins", () => {
    const { ctx, drawn, raw } = mockContext();
    const longTitle = "A very long tree title that goes on and on ".repeat(6);
    const longBranch = "Branch with an extraordinarily long name that keeps going".repeat(2);
    drawCardImage(ctx, sampleStats({ title: longTitle, branches: [{ name: longBranch, color: "#3b82f6", value: 99 }] }));

    const header = drawn[0]!;
    expect(header.text.endsWith("…")).toBe(true);
    expect(header.x + widthOf(raw, header)).toBeLessThanOrEqual(SHARE_WIDTH - 90);

    const name = drawn.find((d) => d.text.startsWith("BRANCH"))!;
    const value = drawn.find((d) => d.text === "99")!;
    expect(name.x + widthOf(raw, name)).toBeLessThanOrEqual(value.x - widthOf(raw, value) - 40);
  });
});
