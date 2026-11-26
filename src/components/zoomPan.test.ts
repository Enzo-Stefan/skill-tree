import { describe, expect, it } from "vitest";
import { MIN_TAP_SCALE, baseView, centerOn, constrain, fitView, minScale, pinchView, wheelFactor, zoomAt } from "./zoomPan";

const content = { width: 1000, height: 1500 };
const pane = { width: 400, height: 700 };

describe("fitView", () => {
  it("shows the whole map, centred", () => {
    const v = fitView(content, pane, 0, 0);
    expect(v.scale).toBeCloseTo(0.4);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo((700 - 1500 * 0.4) / 2);
  });
  it("never enlarges a small map past 100%", () => {
    expect(fitView({ width: 100, height: 100 }, pane).scale).toBe(1);
  });
});

describe("tap-target floor", () => {
  it("starts and fits no smaller than the scale that keeps 44px targets", () => {
    expect(baseView(content, pane).scale).toBeCloseTo(MIN_TAP_SCALE);
    expect(fitView(content, pane).scale).toBeCloseTo(MIN_TAP_SCALE);
  });
  it("does not enlarge a map that already fits", () => {
    expect(fitView({ width: 100, height: 100 }, pane).scale).toBe(1);
  });
});

describe("baseView", () => {
  it("fits the width and shows the bottom of the map", () => {
    const v = baseView(content, pane, 0, 0);
    expect(v.scale).toBeCloseTo(0.4);
    expect(v.y + content.height * v.scale).toBeCloseTo(pane.height);
  });
});

describe("zoomAt", () => {
  it("keeps the point under the cursor in place", () => {
    const view = { scale: 1, x: -100, y: -50 };
    const at = { x: 200, y: 300 };
    const next = zoomAt(view, at, 2, 0.2);
    expect(at.x - (at.x - view.x) * 2).toBeCloseTo(next.x);
    // map point under `at` before and after
    expect((at.x - view.x) / view.scale).toBeCloseTo((at.x - next.x) / next.scale);
    expect((at.y - view.y) / view.scale).toBeCloseTo((at.y - next.y) / next.scale);
  });
  it("stops at the limits", () => {
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, { x: 0, y: 0 }, 99, 0.2).scale).toBe(2.5);
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, { x: 0, y: 0 }, 0.01, 0.2).scale).toBe(0.2);
  });
});

describe("pinchView", () => {
  const start = { scale: 1, x: 0, y: 0 };
  it("doubles the scale when the fingers spread twice as far", () => {
    const v = pinchView(start, [{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 50, y: 100 }, { x: 250, y: 100 }], 0.2);
    expect(v.scale).toBeCloseTo(2);
    // the midpoint (150,100) did not move, so it stays fixed
    expect(v.x).toBeCloseTo(150 - 150 * 2);
  });
  it("drags the map along when both fingers move together", () => {
    const v = pinchView(start, [{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 130, y: 120 }, { x: 230, y: 120 }], 0.2);
    expect(v.scale).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(30);
    expect(v.y).toBeCloseTo(20);
  });
  it("copes with two fingers on the same spot", () => {
    const v = pinchView(start, [{ x: 5, y: 5 }, { x: 5, y: 5 }], [{ x: 9, y: 9 }, { x: 9, y: 9 }], 0.2);
    expect(Number.isFinite(v.scale)).toBe(true);
    expect(v.scale).toBe(1);
  });
});

describe("constrain", () => {
  it("keeps a map that is smaller than the pane centred", () => {
    const v = constrain({ scale: 0.2, x: -999, y: 999 }, content, pane);
    expect(v.x).toBeCloseTo((400 - 200) / 2);
  });
  it("won't let a large map leave the pane", () => {
    const v = constrain({ scale: 1, x: -5000, y: 5000 }, content, pane);
    expect(v.x).toBe(80 - 1000);
    expect(v.y).toBe(700 - 80);
  });
});

describe("wheelFactor", () => {
  it("zooms in when scrolling up and out when scrolling down", () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100)).toBeLessThan(1);
  });
  it("limits one big flick", () => {
    expect(wheelFactor(-100000)).toBeCloseTo(wheelFactor(-240));
  });
});

describe("minScale and centerOn", () => {
  it("lets the player zoom out a little past the fit", () => {
    expect(minScale(content, pane)).toBeLessThan(fitView(content, pane).scale);
  });
  it("puts a map point in the middle", () => {
    const v = centerOn({ x: 500, y: 700 }, 1, pane);
    expect(v.x + 500).toBeCloseTo(200);
    expect(v.y + 700).toBeCloseTo(350);
  });
});
