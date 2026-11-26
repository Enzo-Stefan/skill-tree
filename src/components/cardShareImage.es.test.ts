// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";
import { football } from "../data/football";
import { es } from "../i18n/es";
import { SHARE_WIDTH } from "./shareImage";

/** The language is read once when the app starts, so Spanish needs a fresh module graph. */
let mod: typeof import("./cardShareImage");

beforeAll(async () => {
  vi.stubGlobal("localStorage", { getItem: (k: string) => (k === "skill-tree:language" ? "es" : null) });
  vi.resetModules();
  mod = await import("./cardShareImage");
});

function mockContext() {
  const drawn: { text: string; x: number; font: string }[] = [];
  const ctx = {
    fillStyle: "",
    font: "10px sans-serif",
    textAlign: "start",
    textBaseline: "alphabetic",
    fillRect() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: (text: string) => ({ width: Array.from(text).length * Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 10) * 0.6 }),
    fillText(text: string, x: number) {
      drawn.push({ text, x, font: ctx.font });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, drawn, raw: ctx };
}

describe("player card image in Spanish", () => {
  it("writes the position and foot in Spanish", () => {
    const ratings = { overall: 72, branches: {} };
    const stats = mod.cardShareStats(football, ratings, { position: "DEF", foot: "both" }, "Principiante 3", "example.app");
    expect(stats.details).toBe(`${es.playerCard.positions.DEF} · ${es.playerCard.footLabel.both}`);
  });

  it("draws the Spanish heading and label, and keeps the longest foot label inside the margins", () => {
    const { ctx, drawn, raw } = mockContext();
    const stats = mod.cardShareStats(football, { overall: 99, branches: {} }, { position: "FWD", foot: "left" }, "Intermedio avanzado superior", "example.app");
    mod.drawCardImage(ctx, stats);
    const texts = drawn.map((d) => d.text);
    expect(texts).toContain(es.playerCard.overall.toUpperCase());
    expect(texts.some((x) => x.includes(es.playerCard.title.toUpperCase()))).toBe(true);
    for (const d of drawn.filter((d) => d.text.includes("Pie izquierdo"))) {
      raw.font = d.font;
      expect(d.x + raw.measureText(d.text).width).toBeLessThanOrEqual(SHARE_WIDTH - 90);
    }
  });
});
