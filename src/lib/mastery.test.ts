import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { XP_AMOUNTS } from "../data/xp";
import { amountFor, isEventKey, mergeEvents, totalXp, type XpEvent } from "./xp";
import { LEGACY_STEP, masteryOf, recordPass, recordRetest, stepAtKey, stepNeededForNext, tiersOf } from "./mastery";
import { reconcile } from "./xpSync";
import { computeRatings } from "./ratings";

const T1 = "2026-11-25T10:00:00.000Z";
const T2 = "2026-11-26T10:00:00.000Z";
const T3 = "2026-11-27T10:00:00.000Z";
/** A ledger for skills passed before mastery existed: the skill-pass events the app records, with no mastery rows. */
const legacy = (ids: string[]) => reconcile(football, [], ids, [], T1);
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

  it("is worked out for skills passed before mastery existed: step 1, no XP, never stored as a row", () => {
    const ledger = legacy(["bc1", "bc2"]);
    expect(tiersOf(ledger)).toEqual({ bc1: "bronze", bc2: "bronze" });
    expect(masteryOf(ledger).bc1!.steps).toEqual({ bronze: LEGACY_STEP });
    expect(LEGACY_STEP).toBe(1);
    expect(totalXp(ledger)).toBe(2 * XP_AMOUNTS.skill);
    expect(ledger.some((e) => e.key.startsWith("mastery:") || e.key.startsWith("stepat:"))).toBe(false);
  });

  it("a legacy bronze still lets silver pay in full, but not before Intermediate 1", () => {
    const ledger = legacy(["bc1"]);
    expect(recordRetest(ledger, "bc1", 4, T2).result).toBe("tooSoon");
    const silver = recordRetest(ledger, "bc1", 5, T2);
    expect(silver.result).toBe("silver");
    expect(totalXp(silver.events)).toBe(XP_AMOUNTS.skill + XP_AMOUNTS.mastery.silver);
    expect(tiersOf(silver.events).bc1).toBe("silver");
  });

  it("keeps a real step over the legacy rule when the pass was recorded", () => {
    const ledger = recordPass(legacy(["bc1"]), "bc1", 5, T2);
    expect(masteryOf(ledger).bc1!.steps).toEqual({ bronze: 5 });
    expect(tiersOf(ledger).bc1).toBe("bronze");
  });

  it("a legacy bronze from one device never erases a real 50-XP bronze from another when they merge", () => {
    const phone = recordPass(legacy(["bc1"]), "bc1", 5, T2);
    const laptop = legacy(["bc1"]);
    for (const merged of [mergeEvents(phone, laptop), mergeEvents(laptop, phone)]) {
      expect(totalXp(merged)).toBe(XP_AMOUNTS.skill + XP_AMOUNTS.mastery.bronze);
      expect(masteryOf(merged).bc1!.steps.bronze).toBe(5);
    }
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

  it("at the top the bar is capped at step 16, so Expert players can still progress one tier past the cap", () => {
    const bronze = recordPass([], "bc1", 14, T1);
    expect(recordRetest(bronze, "bc1", 15, T2).result).toBe("tooSoon");
    expect(stepNeededForNext(bronze, "bc1")).toBe(16);
    const silver = recordRetest(bronze, "bc1", 16, T2);
    expect(silver.result).toBe("silver");
    // A tier earned at step 16 has nothing above it: three passes at step 16 never make gold.
    expect(recordRetest(silver.events, "bc1", 16, T3)).toMatchObject({ result: "tooSoon", events: silver.events });
    expect(stepNeededForNext(silver.events, "bc1")).toBeNull();
    const top = recordPass([], "bc2", 16, T1);
    expect(recordRetest(top, "bc2", 16, T2).result).toBe("tooSoon");
    expect(stepNeededForNext(top, "bc2")).toBeNull();
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

describe("hostile keys", () => {
  it("a __proto__ id is just an id: nothing is added to Object.prototype and nothing throws", () => {
    const evil: XpEvent[] = [
      { key: "mastery:__proto__:bronze", xp: 50, active: true, at: T1 },
      { key: "stepat:__proto__:bronze:3", xp: 0, active: true, at: T1 },
      { key: "mastery:constructor:silver", xp: 100, active: true, at: T1 },
      { key: "skill:__proto__:pass", xp: 100, active: true, at: T1 },
    ];
    expect(() => masteryOf(evil)).not.toThrow();
    expect(() => tiersOf(evil)).not.toThrow();
    expect(({} as { tier?: string }).tier).toBeUndefined();
    expect(Object.keys(masteryOf(evil)).sort()).toEqual(["__proto__", "constructor"]);
    expect(tiersOf(evil)["constructor"]).toBe("silver");
  });
});

describe("a pass with no level picked, and the top of the range", () => {
  it("is recorded as step 1 at the lowest, so silver still needs Intermediate 1", () => {
    const bronze = recordPass([], "bc1", 0, T1);
    expect(masteryOf(bronze).bc1!.steps).toEqual({ bronze: LEGACY_STEP });
    expect(recordRetest(bronze, "bc1", 4, T2).result).toBe("tooSoon");
    expect(recordRetest(bronze, "bc1", 5, T2).result).toBe("silver");
    expect(masteryOf(recordPass([], "bc2", -3, T1)).bc2!.steps).toEqual({ bronze: LEGACY_STEP });
  });

  it("gold is reachable when bronze was passed at step 11 or below, in three passes over three levels", () => {
    const bronze = recordPass([], "bc1", 11, T1);
    const silver = recordRetest(bronze, "bc1", 15, T2);
    expect(silver.result).toBe("silver");
    const gold = recordRetest(silver.events, "bc1", 16, T3);
    expect(gold.result).toBe("gold");
    expect(tiersOf(gold.events).bc1).toBe("gold");
    const early = recordPass([], "bc2", 2, T1);
    const s2 = recordRetest(early, "bc2", 6, T2).events;
    expect(recordRetest(s2, "bc2", 10, T3).result).toBe("gold");
  });

  it("gold is not reachable when bronze was passed at step 12 or higher: silver then needs step 16, the last tier", () => {
    const bronze = recordPass([], "bc1", 12, T1);
    expect(recordRetest(bronze, "bc1", 15, T2).result).toBe("tooSoon");
    const silver = recordRetest(bronze, "bc1", 16, T2);
    expect(silver.result).toBe("silver");
    expect(recordRetest(silver.events, "bc1", 16, T3).result).toBe("tooSoon");
    expect(stepNeededForNext(silver.events, "bc1")).toBeNull();
  });
});
