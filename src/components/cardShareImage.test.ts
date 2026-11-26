import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { computeRatings } from "../lib/ratings";
import { es } from "../i18n/es";
import { en } from "../i18n/en";
import { MIN_FONT_PX, cardShareStats, drawCardImage, fitText, type CardShareStats } from "./cardShareImage";
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

interface Rect {
  x: number;
  y: number;
  w: number;
}

interface Drawn {
  text: string;
  x: number;
  font: string;
}

/** A 2D context whose text width is 0.6 em per character at the font size currently set, so shrinking is visible. */
function mockContext() {
  const drawn: Drawn[] = [];
  const rects: Rect[] = [];
  const ctx = {
    fillStyle: "",
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    fillRect(x: number, y: number, w: number) {
      rects.push({ x, y, w });
    },
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
  return { ctx: ctx as unknown as CanvasRenderingContext2D, drawn, rects, raw: ctx };
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

describe("drawCardImage values", () => {
  it("draws the top rating of 99 for the overall and a branch, with a full bar", () => {
    const { ctx, drawn, rects } = mockContext();
    drawCardImage(ctx, sampleStats({ overall: 99, branches: [{ name: "Passing", color: "#3b82f6", value: 99 }] }));
    expect(drawn.filter((d) => d.text === "99")).toHaveLength(2);
    const bars = rects.filter((r) => r.w > 0 && r.w < SHARE_WIDTH).slice(-2);
    expect(bars[1]!.w).toBe(bars[0]!.w);
  });

  it("keeps a value that looks like three digits inside the canvas and clamps its bar", () => {
    const { ctx, drawn, rects, raw } = mockContext();
    drawCardImage(ctx, sampleStats({ overall: 100, branches: [{ name: "Passing", color: "#3b82f6", value: 100 }] }));
    const overall = drawn.find((d) => d.text === "100" && d.font.startsWith("700 300px"))!;
    expect(overall.x + widthOf(raw, overall)).toBeLessThanOrEqual(SHARE_WIDTH - 90);
    const [track, bar] = rects.slice(-2);
    expect(bar!.w).toBeLessThanOrEqual(track!.w);
  });

  it("draws a zero-width bar for a negative value", () => {
    const { ctx, rects } = mockContext();
    drawCardImage(ctx, sampleStats({ branches: [{ name: "Passing", color: "#3b82f6", value: -5 }] }));
    expect(rects.slice(-1)[0]!.w).toBe(0);
  });

  it("shrinks and then truncates a long level and position line inside the margins", () => {
    const { ctx, drawn, raw } = mockContext();
    drawCardImage(ctx, sampleStats({ levelName: "Advanced intermediate with a very long level name ".repeat(3), details: "Midfielder · Both feet" }));
    const line = drawn.find((d) => d.text.includes("Advanced"))!;
    expect(line.text.endsWith("…")).toBe(true);
    expect(line.font).toContain(`${MIN_FONT_PX}px`);
    expect(line.x + widthOf(raw, line)).toBeLessThanOrEqual(SHARE_WIDTH - 90);
  });

  it("draws only the level when there are no details, and nothing when both are empty", () => {
    const a = mockContext();
    drawCardImage(a.ctx, sampleStats({ details: "" }));
    expect(a.drawn.map((d) => d.text)).toContain("Beginner 3");
    const b = mockContext();
    drawCardImage(b.ctx, sampleStats({ levelName: null, details: "" }));
    expect(b.drawn.some((d) => d.text.includes("Beginner"))).toBe(false);
  });
});

describe("fitText", () => {
  it("keeps the text and the largest size when it fits", () => {
    const { ctx, raw } = mockContext();
    expect(fitText(ctx, "abc", 1000, 600, 40)).toBe("abc");
    expect(raw.font).toBe("600 40px " + raw.font.split("px ")[1]);
  });

  it("shrinks in steps of 2px until it fits without changing the text", () => {
    const { ctx, raw } = mockContext();
    // 10 chars at 0.6 em: 40px is 240 wide, 30px is 180, 28px is 168.
    expect(fitText(ctx, "abcdefghij", 170, 600, 40)).toBe("abcdefghij");
    expect(raw.font.startsWith("600 28px")).toBe(true);
  });

  it("stops at the minimum size and truncates with an ellipsis", () => {
    const { ctx, raw } = mockContext();
    const out = fitText(ctx, "x".repeat(100), 200, 600, 40);
    expect(out.endsWith("…")).toBe(true);
    expect(raw.font.startsWith(`600 ${MIN_FONT_PX}px`)).toBe(true);
    expect(raw.measureText(out).width).toBeLessThanOrEqual(200);
    expect(out.length).toBeGreaterThan(1);
  });

  it("returns only the ellipsis when not even one character fits, and does not split an emoji", () => {
    const { ctx } = mockContext();
    expect(fitText(ctx, "abc", 1, 600, 40)).toBe("…");
    const out = fitText(ctx, "😀".repeat(60), 150, 600, 40);
    expect(Array.from(out.slice(0, -1)).every((c) => c === "😀")).toBe(true);
  });
});
