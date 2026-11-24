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
  mergeLiftLogs,
  parseKg,
  personalBest,
  removeLiftEntry,
  replayLiftLog,
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

describe("merging lift logs (account sync)", () => {
  it("keeps entries from both, and one copy of an entry both already have", () => {
    const here = [squat("2026-11-18", 40), squat("2026-11-20", 45)];
    const account = [squat("2026-11-18", 40), squat("2026-11-19", 42.5)];
    expect(mergeLiftLogs(weights, here, account)).toEqual([squat("2026-11-18", 40), squat("2026-11-19", 42.5), squat("2026-11-20", 45)]);
  });

  it("keeps two sessions at the same weight on the same day if one side has both", () => {
    const here = [squat("2026-11-20", 40), squat("2026-11-20", 40)];
    expect(mergeLiftLogs(weights, here, [squat("2026-11-20", 40)])).toEqual(here);
  });

  it("replays entries logged here onto the account, keeping other devices' entries", () => {
    const base = [squat("2026-11-18", 40)];
    const account = [squat("2026-11-18", 40), squat("2026-11-19", 42.5)];
    const here = [squat("2026-11-18", 40), squat("2026-11-20", 45)];
    expect(replayLiftLog(weights, account, base, here)).toEqual([squat("2026-11-18", 40), squat("2026-11-19", 42.5), squat("2026-11-20", 45)]);
  });

  it("an entry undone here, or a reset, stays gone", () => {
    const base = [squat("2026-11-18", 40), squat("2026-11-20", 450)];
    const account = [...base, squat("2026-11-21", 50)];
    expect(replayLiftLog(weights, account, base, [squat("2026-11-18", 40)])).toEqual([squat("2026-11-18", 40), squat("2026-11-21", 50)]);
    expect(replayLiftLog(weights, account, base, [])).toEqual([squat("2026-11-21", 50)]);
  });

  it("doesn't bring back an entry undone on another device", () => {
    const base = [squat("2026-11-18", 40), squat("2026-11-20", 450)];
    const account = [squat("2026-11-18", 40)];
    expect(replayLiftLog(weights, account, base, base)).toEqual([squat("2026-11-18", 40)]);
  });
});

describe("replaying lifts twice", () => {
  it("doesn't double an entry whose save already reached the account", () => {
    const base = [squat("2026-11-18", 40)];
    const here = [squat("2026-11-18", 40), squat("2026-11-20", 45)];
    // The save got through, but the page closed before the browser updated its copy of the account.
    const account = here;
    expect(replayLiftLog(weights, account, base, here)).toEqual(here);
  });

  it("still adds a second session at the same weight logged here", () => {
    const base = [squat("2026-11-20", 45)];
    const here = [squat("2026-11-20", 45), squat("2026-11-20", 45)];
    expect(replayLiftLog(weights, base, base, here)).toEqual(here);
  });

  it("doesn't bring back an entry removed on another device when one more is added here", () => {
    const base = [squat("2026-11-20", 45)];
    const here = [squat("2026-11-20", 45), squat("2026-11-20", 45)];
    expect(replayLiftLog(weights, [], base, here)).toEqual([squat("2026-11-20", 45)]);
  });

  it("doesn't remove a second copy when an undo's save already reached the account", () => {
    const base = [squat("2026-11-20", 45), squat("2026-11-20", 45)];
    const here = [squat("2026-11-20", 45)];
    // The undo got through, but the page closed before the browser updated its copy of the account.
    const account = replayLiftLog(weights, base, base, here);
    expect(account).toEqual(here);
    expect(replayLiftLog(weights, account, base, here)).toEqual(here);
  });

  it("still removes everything on a reset replayed twice", () => {
    const base = [squat("2026-11-20", 45), squat("2026-11-20", 45)];
    expect(replayLiftLog(weights, base, base, [])).toEqual([]);
    expect(replayLiftLog(weights, [], base, [])).toEqual([]);
  });
});

describe("weights in the reader's language", () => {
  it("writes kg with the language's decimal mark", () => {
    expect(formatKg(62.5)).toBe("62.5 kg");
    expect(formatKg(62.5, "es")).toBe("62,5 kg");
    expect(formatKg(60, "es")).toBe("60 kg");
  });
});
