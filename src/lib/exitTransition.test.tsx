// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useExitTransition } from "./exitTransition";

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
