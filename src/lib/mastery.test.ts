import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { XP_AMOUNTS } from "../data/xp";
import { amountFor, isEventKey, totalXp, type XpEvent } from "./xp";
import { backfillBronze, masteryOf, recordPass, recordRetest, stepAtKey, stepNeededForNext, tiersOf } from "./mastery";
import { reconcile } from "./xpSync";
import { computeRatings } from "./ratings";

const T1 = "2026-11-25T10:00:00.000Z";
const T2 = "2026-11-26T10:00:00.000Z";
const T3 = "2026-11-27T10:00:00.000Z";
const tiers = (events: XpEvent[], id: string) => tiersOf(events)[id] ?? null;

describe("the step marker key", () => {
  it("is a valid key worth nothing, and only for real tiers and steps", () => {
    const key = stepAtKey("bc1", "silver", 7);
    expect(key).toBe("stepat:bc1:silver:7");
    expect(isEventKey(key)).toBe(true);
    expect(amountFor(key)).toBe(0);
    for (const bad of ["stepat:bc1:platinum:7", "stepat:bc1:silver:x", "stepat:bc1:silver", "stepat:bc1:silver:123"]) expect(amountFor(bad), bad).toBeNull();
  });
});

describe("bronze", () => {
  it("is earned by passing, keeps the step, pays the bronze amount once", () => {
    const once = recordPass([], "bc1", 3, T1);
    expect(tiers(once, "bc1")).toBe("bronze");
    expect(masteryOf(once).bc1!.steps).toEqual({ bronze: 3 });
    expect(totalXp(once)).toBe(XP_AMOUNTS.mastery.bronze);
    expect(recordPass(once, "bc1", 9, T2)).toBe(once);
  });

  it("is given as step 0 to skills passed before mastery existed, and only once", () => {
    const ledger = backfillBronze([], ["bc1", "bc2"], T1);
    expect(tiersOf(ledger)).toEqual({ bc1: "bronze", bc2: "bronze" });
    expect(masteryOf(ledger).bc1!.steps).toEqual({ bronze: 0 });
    expect(backfillBronze(ledger, ["bc1", "bc2"], T2)).toBe(ledger);
  });

  it("keeps a real step over the backfill when the pass was recorded first", () => {
    const ledger = backfillBronze(recordPass([], "bc1", 5, T1), ["bc1"], T2);
    expect(masteryOf(ledger).bc1!.steps).toEqual({ bronze: 5 });
  });
});

describe("silver and gold: one full level above the previous tier", () => {
  it("silver needs a step at least 4 above the bronze pass", () => {
    const bronze = recordPass([], "bc1", 2, T1);
    expect(recordRetest(bronze, "bc1", 5, T2)).toMatchObject({ result: "tooSoon", events: bronze });
    const silver = recordRetest(bronze, "bc1", 6, T2);
    expect(silver.result).toBe("silver");
    expect(tiers(silver.events, "bc1")).toBe("silver");
    expect(masteryOf(silver.events).bc1!.steps).toEqual({ bronze: 2, silver: 6 });
    expect(totalXp(silver.events)).toBe(XP_AMOUNTS.mastery.bronze + XP_AMOUNTS.mastery.silver);
  });

  it("gold needs a step at least 4 above the silver pass, and a gold skill stays gold", () => {
    let events = recordRetest(recordPass([], "bc1", 1, T1), "bc1", 5, T2).events;
    expect(recordRetest(events, "bc1", 8, T3).result).toBe("tooSoon");
    const gold = recordRetest(events, "bc1", 9, T3);
    expect(gold.result).toBe("gold");
    events = gold.events;
    expect(tiers(events, "bc1")).toBe("gold");
    expect(totalXp(events)).toBe(XP_AMOUNTS.mastery.bronze + XP_AMOUNTS.mastery.silver + XP_AMOUNTS.mastery.gold);
    expect(recordRetest(events, "bc1", 16, T3)).toEqual({ events, result: "maxed" });
  });

  it("a Beginner can only earn silver after moving up a level, and one tier per retest", () => {
    const bronze = recordPass([], "bc1", 1, T1);
    for (const step of [1, 2, 3, 4]) expect(recordRetest(bronze, "bc1", step, T2).result, `step ${step}`).toBe("tooSoon");
    const jump = recordRetest(bronze, "bc1", 16, T2);
    expect(jump.result).toBe("silver");
    expect(tiers(jump.events, "bc1")).toBe("silver");
  });

  it("a skill passed before mastery (step 0) earns silver from Intermediate 1 (step 5, any step 4 or more)", () => {
    const ledger = backfillBronze([], ["bc1"], T1);
    expect(recordRetest(ledger, "bc1", 3, T2).result).toBe("tooSoon");
    expect(recordRetest(ledger, "bc1", 4, T2).result).toBe("silver");
  });

  it("at the very top the bar is capped at step 16, so Expert players can still progress", () => {
    const bronze = recordPass([], "bc1", 14, T1);
    expect(recordRetest(bronze, "bc1", 15, T2).result).toBe("tooSoon");
    expect(recordRetest(bronze, "bc1", 16, T2).result).toBe("silver");
    expect(stepNeededForNext(bronze, "bc1")).toBe(16);
  });

  it("does nothing for a skill that was never passed, or a bad step", () => {
    expect(recordRetest([], "bc1", 9, T1)).toEqual({ events: [], result: "notPassed" });
    const bronze = recordPass([], "bc1", 1, T1);
    expect(recordRetest(bronze, "bc1", -5, T2).result).toBe("tooSoon");
    expect(recordRetest(bronze, "bc1", 400, T2).result).toBe("silver");
  });

  it("tells the step the next tier needs, and null when there is none", () => {
    expect(stepNeededForNext([], "bc1")).toBeNull();
    const bronze = recordPass([], "bc1", 2, T1);
    expect(stepNeededForNext(bronze, "bc1")).toBe(6);
    const gold = recordRetest(recordRetest(bronze, "bc1", 6, T2).events, "bc1", 10, T3).events;
    expect(stepNeededForNext(gold, "bc1")).toBeNull();
  });
});

describe("undo and the ledger", () => {
  it("un-ticking a skill takes its tiers, step markers and XP away, and a new pass starts again from bronze", () => {
    let ledger = recordRetest(recordPass([], "bc1", 1, T1), "bc1", 5, T2).events;
    expect(tiers(ledger, "bc1")).toBe("silver");
    ledger = reconcile(football, ledger, [], [], T3);
    expect(tiers(ledger, "bc1")).toBeNull();
    expect(totalXp(ledger)).toBe(0);
    ledger = recordPass(ledger, "bc1", 9, "2026-11-28T10:00:00.000Z");
    expect(tiers(ledger, "bc1")).toBe("bronze");
    expect(masteryOf(ledger).bc1!.steps.bronze).toBe(9);
  });

  it("merges like the rest of XP: the same tier earned on two devices pays once", () => {
    const phone = recordRetest(recordPass([], "bc1", 1, T1), "bc1", 5, T2).events;
    const laptop = recordRetest(recordPass([], "bc1", 1, T1), "bc1", 5, T3).events;
    const keys = new Set([...phone, ...laptop].map((e) => e.key));
    expect(keys.size).toBe(phone.length);
    expect(totalXp(phone)).toBe(XP_AMOUNTS.mastery.bronze + XP_AMOUNTS.mastery.silver);
  });
});

describe("the rating formula gets the tiers", () => {
  it("gold on every passed skill lifts the top rating from 85 to 99", () => {
    const done = new Set(football.skills.map((s) => s.id));
    const mastery = Object.fromEntries(football.skills.filter((s) => s.branch).map((s) => [s.id, "gold" as const]));
    expect(computeRatings({ tree: football, done, levelStep: 16, mastery }).overall).toBe(99);
  });
});
