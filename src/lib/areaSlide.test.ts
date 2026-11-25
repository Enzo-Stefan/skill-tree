import { afterEach, describe, expect, it, vi } from "vitest";
import type { Tree } from "../types";
import { panelIn, panelOut, slideDirection, slideIn } from "./areaSlide";

const tree = { branches: [{ id: "a" }, { id: "b" }, { id: "c" }] } as Tree;

describe("slideDirection", () => {
  it("comes from the right for a later area and from the left for an earlier one", () => {
    expect(slideDirection(tree, "a", "c")).toBe(1);
    expect(slideDirection(tree, "c", "b")).toBe(-1);
  });
  it("does not slide when the area is the same", () => {
    expect(slideDirection(tree, "b", "b")).toBe(0);
    expect(slideDirection(tree, null, null)).toBe(0);
  });
  it("treats All as before the first area", () => {
    expect(slideDirection(tree, null, "a")).toBe(1);
    expect(slideDirection(tree, "a", null)).toBe(-1);
  });
});

function fakeEl() {
  const animation: { onfinish: (() => void) | null; oncancel: (() => void) | null } = { onfinish: null, oncancel: null };
  const animate = vi.fn(() => animation);
  return { el: { animate } as unknown as HTMLElement, animate, animation };
}

function reducedMotion(on: boolean) {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: on }) });
}

afterEach(() => vi.unstubAllGlobals());

describe("slideIn", () => {
  it("does nothing under reduced motion or with direction 0", () => {
    const { el, animate } = fakeEl();
    reducedMotion(true);
    slideIn(el, 1);
    reducedMotion(false);
    slideIn(el, 0);
    expect(animate).not.toHaveBeenCalled();
  });
  it("does nothing when the browser has no element.animate", () => {
    reducedMotion(false);
    expect(() => slideIn({} as HTMLElement, 1)).not.toThrow();
  });
  it("animates otherwise", () => {
    const { el, animate } = fakeEl();
    reducedMotion(false);
    slideIn(el, 1);
    expect(animate).toHaveBeenCalledTimes(1);
  });
});

describe("panelIn and panelOut", () => {
  it("panelIn does not animate under reduced motion", () => {
    const { el, animate } = fakeEl();
    reducedMotion(true);
    panelIn(el);
    expect(animate).not.toHaveBeenCalled();
  });
  it("panelOut finishes at once under reduced motion", () => {
    const { el, animate } = fakeEl();
    const done = vi.fn();
    reducedMotion(true);
    panelOut(el, done);
    expect(animate).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("without element.animate, panelIn does nothing and panelOut finishes at once", () => {
    const el = {} as HTMLElement;
    const done = vi.fn();
    reducedMotion(false);
    expect(() => panelIn(el)).not.toThrow();
    panelOut(el, done);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("tolerates a missing element", () => {
    const done = vi.fn();
    reducedMotion(false);
    expect(() => panelIn(null)).not.toThrow();
    panelOut(null, done);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("panelOut calls done only when the animation finishes", () => {
    const { el, animate, animation } = fakeEl();
    const done = vi.fn();
    reducedMotion(false);
    panelIn(el);
    panelOut(el, done);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(done).not.toHaveBeenCalled();
    animation.onfinish?.();
    expect(done).toHaveBeenCalledTimes(1);
  });
});
