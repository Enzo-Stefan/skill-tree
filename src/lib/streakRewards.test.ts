import { describe, expect, it } from "vitest";
import { XP_AMOUNTS } from "../data/xp";
import { amountFor, isEventKey, streakKey, totalXp } from "./xp";
import { applyStreakRewards, milestones, reachedMilestones } from "./streakRewards";
import { RECENT_WEEKS } from "./streak";

const T1 = "2026-11-25T10:00:00.000Z";
const T2 = "2026-11-26T10:00:00.000Z";

describe("the milestones", () => {
  it("are all reachable: none is longer than the weeks the streak counts", () => {
    for (const m of milestones()) expect(m, `${m} weeks`).toBeLessThanOrEqual(RECENT_WEEKS);
    expect(milestones()).toEqual([4, 8]);
  });

  it("are reached once the streak is long enough", () => {
    expect(reachedMilestones(3)).toEqual([]);
    expect(reachedMilestones(4)).toEqual([4]);
    expect(reachedMilestones(7)).toEqual([4]);
    expect(reachedMilestones(8)).toEqual([4, 8]);
  });
});

describe("keys and amounts", () => {
  it("makes valid keys that name the run", () => {
    expect(streakKey(4, null)).toBe("streak:4:start");
    expect(streakKey(8, "2026-11-02")).toBe("streak:8:2026-11-02");
    for (const k of [streakKey(4, null), streakKey(8, "2026-11-02")]) expect(isEventKey(k), k).toBe(true);
  });

  it("pays the milestone amount for every accepted shape, and nothing for odd ones", () => {
    expect(amountFor(streakKey(4, null))).toBe(XP_AMOUNTS.streak[4]);
    expect(amountFor(streakKey(8, "2026-11-02"))).toBe(XP_AMOUNTS.streak[8]);
    for (const k of ["streak:4", "streak:04", "streak:4:x", "streak:4:2026-13-45x", "streak:5", "streak:12", "streak:4:start:extra"]) expect(amountFor(k), k).toBeNull();
  });
});

describe("applyStreakRewards", () => {
  it("awards each reached milestone once for a run, however often it is called", () => {
    let ledger = applyStreakRewards([], 4, null, T1);
    expect(totalXp(ledger)).toBe(XP_AMOUNTS.streak[4]);
    expect(applyStreakRewards(ledger, 4, null, T2)).toBe(ledger);
    ledger = applyStreakRewards(ledger, 8, null, T2);
    expect(totalXp(ledger)).toBe(XP_AMOUNTS.streak[4]! + XP_AMOUNTS.streak[8]!);
    expect(ledger).toHaveLength(2);
  });

  it("gives nothing below the first milestone", () => {
    expect(applyStreakRewards([], 3, null, T1)).toEqual([]);
  });

  it("lets a new run after a level step earn the milestones again, without touching the old run", () => {
    let ledger = applyStreakRewards([], 4, null, T1);
    ledger = applyStreakRewards(ledger, 4, "2026-11-23", T2);
    expect(ledger.map((e) => e.key).sort()).toEqual(["streak:4:2026-11-23", "streak:4:start"]);
    expect(totalXp(ledger)).toBe(2 * XP_AMOUNTS.streak[4]!);
  });

  it("keeps a bonus when the streak later drops, because the milestone was reached", () => {
    let ledger = applyStreakRewards([], 8, null, T1);
    ledger = applyStreakRewards(ledger, 2, null, T2);
    expect(totalXp(ledger)).toBe(XP_AMOUNTS.streak[4]! + XP_AMOUNTS.streak[8]!);
  });
});
