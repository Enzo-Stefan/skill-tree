import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import type { SavedProgress } from "./cloud";
import { mergeProgress } from "./cloud";
import { rebaseProgress } from "./sync";

const none = { since: null, askedWeek: null };
const empty: SavedProgress = { done: [], playerLevel: null, playerStep: 1, practiceDays: [], streak: none };
const base: SavedProgress = { ...empty, done: ["root"], playerLevel: "beginner", playerStep: 2, streak: { since: "2026-11-02", askedWeek: null } };

describe("rebaseProgress: step moves on two devices", () => {
  it("answering 'ask later' here doesn't undo a step another device moved up to", () => {
    // Device A moved up to Beginner 3 and saved. Device B, offline, only tapped "ask me later".
    const account: SavedProgress = { ...base, playerStep: 3, streak: { since: "2026-11-16", askedWeek: null } };
    const local: SavedProgress = { ...base, streak: { since: "2026-11-02", askedWeek: "2026-11-16" } };
    const out = rebaseProgress(football, account, base, local);
    expect(out.playerStep).toBe(3);
    expect(out.streak.since).toBe("2026-11-16");
    expect(out.streak.askedWeek).toBe("2026-11-16");
  });

  it("a step moved up here still wins, with its streak", () => {
    const account: SavedProgress = { ...base, done: ["root", "ps1"] };
    const local: SavedProgress = { ...base, playerStep: 3, streak: { since: "2026-11-16", askedWeek: null } };
    const out = rebaseProgress(football, account, base, local);
    expect(out).toMatchObject({ playerStep: 3, streak: { since: "2026-11-16", askedWeek: null } });
    expect(out.done.sort()).toEqual(["ps1", "root"]);
  });

  it("an asked-week from the account is kept when nothing changed here", () => {
    const account: SavedProgress = { ...base, streak: { since: "2026-11-02", askedWeek: "2026-11-23" } };
    expect(rebaseProgress(football, account, base, base).streak.askedWeek).toBe("2026-11-23");
  });
});

describe("mergeProgress: the first sign-in of a guest", () => {
  it("keeps guest skills, days and level when the account is empty of them", () => {
    const guest: SavedProgress = { ...base, done: ["root", "bc1"], practiceDays: ["2026-11-18"] };
    expect(mergeProgress(football, guest, { ...empty, done: ["ps1"] })).toMatchObject({
      playerLevel: "beginner",
      playerStep: 2,
      practiceDays: ["2026-11-18"],
      streak: base.streak,
    });
  });
  it("is the same whichever side holds a skill, and doing it twice changes nothing", () => {
    const a: SavedProgress = { ...base, done: ["root", "bc1"] };
    const b: SavedProgress = { ...base, done: ["root", "ps1"] };
    const once = mergeProgress(football, a, b);
    expect([...once.done].sort()).toEqual(["bc1", "ps1", "root"]);
    expect(mergeProgress(football, once, b)).toEqual(once);
    expect([...mergeProgress(football, b, a).done].sort()).toEqual(["bc1", "ps1", "root"]);
  });
});
