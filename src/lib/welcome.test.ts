import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWelcomeSkipped, saveWelcomeSkipped } from "./welcome";

describe("welcome screen skip", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is not skipped on a fresh browser", () => {
    expect(loadWelcomeSkipped()).toBe(false);
  });

  it("remembers a skip", () => {
    saveWelcomeSkipped();
    expect(loadWelcomeSkipped()).toBe(true);
  });

  it("treats blocked storage as not skipped", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadWelcomeSkipped()).toBe(false);
  });
});
