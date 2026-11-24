import { beforeEach, describe, expect, it } from "vitest";
import { weights } from "../data/weights";
import {
  addLiftEntry,
  bestProgression,
  cleanLiftLog,
  formatKg,
  isNewBest,
  liftHistory,
  loadLiftLog,
  MAX_ENTRIES,
  parseKg,
  personalBest,
  removeLiftEntry,
  saveLiftLog,
  type LiftEntry,
} from "./lifts";

const squat = (date: string, kg: number): LiftEntry => ({ skillId: "lg1", date, kg });

describe("parseKg (what the player types)", () => {
  it.each([
    ["60", 60],
    [" 62.5 ", 62.5],
    ["62,5", 62.5],
    ["0", 0],
    ["61.3", 61.25],
  ])("reads %s as %s kg", (input, kg) => {
    expect(parseKg(input)).toBe(kg);
  });

  it.each(["", "abc", "-5", "60kg", "501", "1e3"])("rejects %s", (input) => {
    expect(parseKg(input)).toBeNull();
  });
});

describe("the lift log", () => {
  it("keeps entries in date order, even when one is added for an earlier day", () => {
    let log: LiftEntry[] = [];
    log = addLiftEntry(weights, log, squat("2026-11-20", 30));
    log = addLiftEntry(weights, log, squat("2026-11-10", 25));
    expect(log.map((e) => e.date)).toEqual(["2026-11-10", "2026-11-20"]);
  });

  it("only logs lifts, not bodyweight skills or skills from another tree", () => {
    let log: LiftEntry[] = [];
    log = addLiftEntry(weights, log, { skillId: "cr1", date: "2026-11-20", kg: 10 });
    log = addLiftEntry(weights, log, { skillId: "nope", date: "2026-11-20", kg: 10 });
    expect(log).toEqual([]);
  });

  it("drops broken entries from an old or edited save", () => {
    const raw = [squat("2026-11-20", 30), squat("2026-02-30", 30), { ...squat("2026-11-21", 30), kg: 9999 }, { skillId: "lg1" }, "junk", null];
    expect(cleanLiftLog(weights, raw)).toEqual([squat("2026-11-20", 30)]);
    expect(cleanLiftLog(weights, { not: "a list" })).toEqual([]);
  });

  it("keeps only the newest entries when there are too many", () => {
    const raw = Array.from({ length: MAX_ENTRIES + 5 }, (_, i) => squat(`2026-01-01`, i % 100));
    expect(cleanLiftLog(weights, raw)).toHaveLength(MAX_ENTRIES);
  });

  it("can remove an entry typed by mistake", () => {
    const log = [squat("2026-11-10", 25), squat("2026-11-20", 300)];
    expect(removeLiftEntry(log, log[1])).toEqual([squat("2026-11-10", 25)]);
  });

  it("undo works with the entry just added, not only one taken from the log", () => {
    const typo = squat("2026-11-20", 300);
    const log = addLiftEntry(weights, [squat("2026-11-10", 25)], typo);
    expect(log).toHaveLength(2);
    expect(removeLiftEntry(log, typo)).toEqual([squat("2026-11-10", 25)]);
  });

  it("removes only the last one when the same entry was logged twice", () => {
    const log = [squat("2026-11-20", 30), squat("2026-11-20", 30)];
    expect(removeLiftEntry(log, squat("2026-11-20", 30))).toHaveLength(1);
  });

  it("leaves the log alone when the entry isn't in it", () => {
    const log = [squat("2026-11-20", 30)];
    expect(removeLiftEntry(log, squat("2026-11-21", 30))).toBe(log);
  });
});

describe("personal bests", () => {
  const log = [
    squat("2026-10-01", 20),
    squat("2026-10-08", 25),
    squat("2026-10-15", 22.5),
    squat("2026-10-22", 25),
    squat("2026-10-29", 30),
    { skillId: "lg3", date: "2026-10-29", kg: 60 },
  ];

  it("is the heaviest weight, the first time it was lifted", () => {
    expect(personalBest(log, "lg1")).toEqual(squat("2026-10-29", 30));
    expect(personalBest(log.slice(0, 4), "lg1")).toEqual(squat("2026-10-08", 25));
    expect(personalBest(log, "lg2")).toBeNull();
  });

  it("shows how the best went up over time, skipping days that didn't beat it", () => {
    expect(bestProgression(log, "lg1").map((e) => e.kg)).toEqual([20, 25, 30]);
  });

  it("keeps each lift's history separate", () => {
    expect(liftHistory(log, "lg3")).toHaveLength(1);
    expect(liftHistory(log, "lg1")).toHaveLength(5);
  });

  it("knows when an entry is a new best", () => {
    expect(isNewBest(log, squat("2026-11-05", 32.5))).toBe(true);
    expect(isNewBest(log, squat("2026-11-05", 30))).toBe(false);
    expect(isNewBest(log, { skillId: "lg2", date: "2026-11-05", kg: 10 })).toBe(true);
  });

  it("writes weights without trailing zeros", () => {
    expect([formatKg(62.5), formatKg(60), formatKg(61.25)]).toEqual(["62.5 kg", "60 kg", "61.25 kg"]);
  });
});

describe("saving in the browser", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;
  });

  it("loads what was saved, per tree", () => {
    saveLiftLog("weights", [squat("2026-11-20", 30)]);
    expect(loadLiftLog(weights)).toEqual([squat("2026-11-20", 30)]);
    expect(store.has("skill-tree:weights:lift-log")).toBe(true);
  });

  it("starts empty when nothing or something broken was saved", () => {
    expect(loadLiftLog(weights)).toEqual([]);
    store.set("skill-tree:weights:lift-log", "{not json");
    expect(loadLiftLog(weights)).toEqual([]);
  });
});

describe("the weight training tree", () => {
  it("marks the weighted lifts, and leaves bodyweight and jump skills unmarked", () => {
    const lifts = weights.skills.filter((s) => s.logWeight).map((s) => s.id);
    expect(lifts).toContain("lg4");
    expect(lifts).not.toContain("cr1");
    expect(lifts).not.toContain("pw1");
    expect(lifts).not.toContain("root");
  });
});

describe("weights in the reader's language", () => {
  it("writes kg with the language's decimal mark", () => {
    expect(formatKg(62.5)).toBe("62.5 kg");
    expect(formatKg(62.5, "es")).toBe("62,5 kg");
    expect(formatKg(60, "es")).toBe("60 kg");
  });
});
