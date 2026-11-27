// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { leaveScreen, useExitTransition } from "./exitTransition";

function reduced(on: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: on }));
}

describe("useExitTransition", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("stays mounted for the exit, then unmounts", () => {
    vi.useFakeTimers();
    reduced(false);
    const { result, rerender } = renderHook(({ open }) => useExitTransition(open, 150), { initialProps: { open: true } });
    rerender({ open: false });
    expect(result.current).toEqual({ mounted: true, closing: true });
    act(() => void vi.advanceTimersByTime(150));
    expect(result.current).toEqual({ mounted: false, closing: false });
  });

  it("unmounts at once under reduced motion", () => {
    reduced(true);
    const { result, rerender } = renderHook(({ open }) => useExitTransition(open, 150), { initialProps: { open: true } });
    rerender({ open: false });
    expect(result.current).toEqual({ mounted: false, closing: false });
  });
});

describe("leaveScreen", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("gives the leaving copy the scroll position of the train and its tree", () => {
    reduced(false);
    // jsdom does no layout, so scrollTop is a plain stored value here.
    const store = new WeakMap<Element, number>();
    vi.spyOn(HTMLElement.prototype, "scrollTop", "get").mockImplementation(function (this: HTMLElement) {
      return store.get(this) ?? 0;
    });
    vi.spyOn(HTMLElement.prototype, "scrollTop", "set").mockImplementation(function (this: HTMLElement, v: number) {
      store.set(this, v);
    });
    const animate = vi.fn(() => ({ onfinish: null, oncancel: null }));
    Object.defineProperty(HTMLElement.prototype, "animate", { value: animate, configurable: true });

    const content = document.createElement("div");
    content.className = "content";
    content.innerHTML = '<div class="train"><div class="tree-wrap"><p id="x">skills</p></div></div>';
    document.body.appendChild(content);
    const train = content.querySelector<HTMLElement>(".train")!;
    const tree = content.querySelector<HTMLElement>(".tree-wrap")!;
    train.scrollTop = 300;
    tree.scrollTop = 40;

    leaveScreen(content);

    const copy = content.querySelector<HTMLElement>(".screen-leaving")!;
    expect(copy).not.toBeNull();
    expect(copy.scrollTop).toBe(300);
    expect(copy.querySelector<HTMLElement>(".tree-wrap")!.scrollTop).toBe(40);
    expect(copy.querySelector("[id]")).toBeNull();
    expect(content.querySelector("#x")).not.toBeNull();
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  });
});
