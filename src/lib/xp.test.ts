import { describe, expect, it } from "vitest";
import { XP_AMOUNTS } from "../data/xp";
import {
  amountFor,
  award,
  challengeKey,
  cleanEvents,
  hasAward,
  isEventKey,
  masteryKey,
  mergeEvents,
  revoke,
  sessionKey,
  passDayKey,
  skillPassKey,
  streakKey,
  totalXp,
  xpLevel,
  type XpEvent,
} from "./xp";

const T1 = "2026-11-25T10:00:00.000Z";
const T2 = "2026-11-25T11:00:00.000Z";
const T3 = "2026-11-25T12:00:00.000Z";

describe("event keys and amounts", () => {
  it("builds keys the cleaner accepts, and rejects other strings", () => {
    for (const k of [skillPassKey("bc1"), sessionKey("2026-11-25"), challengeKey("c-juggle", "2026-11-25"), masteryKey("bc1", "gold"), streakKey(4, null)]) {
      expect(isEventKey(k), k).toBe(true);
    }
    for (const k of ["", "skill", "Skill:bc1:pass", "skill:bc 1:pass", "skill:" + "x".repeat(100), 42, null]) expect(isEventKey(k), String(k)).toBe(false);
  });

  it("gives each kind of key its amount, and nothing for keys we do not award", () => {
    expect(amountFor(skillPassKey("bc1"))).toBe(XP_AMOUNTS.skill);
    expect(amountFor(sessionKey("2026-11-25"))).toBe(XP_AMOUNTS.session);
    expect(amountFor(challengeKey("c1", "2026-11-25"))).toBe(XP_AMOUNTS.challengeDaily);
    expect(amountFor(challengeKey("c1", "2026-11-23"), true)).toBe(XP_AMOUNTS.challengeWeekly);
    expect(amountFor(masteryKey("bc1", "silver"))).toBe(XP_AMOUNTS.mastery.silver);
    expect(amountFor(streakKey(8, null))).toBe(XP_AMOUNTS.streak[8]);
    expect(amountFor(streakKey(5, null))).toBeNull();
    expect(amountFor("skill:bc1:fail")).toBeNull();
    expect(amountFor("mastery:bc1:platinum")).toBeNull();
    expect(amountFor("nonsense")).toBeNull();
  });
});

describe("award and revoke", () => {
  it("pays once, however many times the same key is awarded", () => {
    let ledger: XpEvent[] = [];
    ledger = award(ledger, skillPassKey("bc1"), 100, T1);
    const again = award(ledger, skillPassKey("bc1"), 100, T2);
    expect(again).toBe(ledger);
    expect(totalXp(award(again, skillPassKey("bc1"), 999, T3))).toBe(100);
  });

  it("adds different keys together", () => {
    let ledger: XpEvent[] = [];
    ledger = award(ledger, skillPassKey("bc1"), 100, T1);
    ledger = award(ledger, sessionKey("2026-11-25"), 40, T1);
    expect(totalXp(ledger)).toBe(140);
  });

  it("takes the XP away on undo and gives the same amount back on a new pass, even if the amount was retuned", () => {
    let ledger = award([], skillPassKey("bc1"), 100, T1);
    ledger = revoke(ledger, skillPassKey("bc1"), T2);
    expect(totalXp(ledger)).toBe(0);
    expect(hasAward(ledger, skillPassKey("bc1"))).toBe(false);
    ledger = award(ledger, skillPassKey("bc1"), 250, T3);
    expect(totalXp(ledger)).toBe(100);
    expect(ledger).toHaveLength(1);
  });

  it("ignores a revoke of something never awarded, and refuses bad keys and amounts", () => {
    const empty: XpEvent[] = [];
    expect(revoke(empty, skillPassKey("bc1"), T1)).toBe(empty);
    expect(award(empty, "nonsense", 100, T1)).toBe(empty);
    expect(award(empty, skillPassKey("bc1"), null, T1)).toBe(empty);
    expect(award(empty, skillPassKey("bc1"), -5, T1)).toBe(empty);
    expect(award(empty, skillPassKey("bc1"), 1.5, T1)).toBe(empty);
    expect(award(empty, skillPassKey("bc1"), 10_001, T1)).toBe(empty);
  });
});

describe("merging two copies of the ledger", () => {
  const ev = (key: string, xp: number, active: boolean, at: string): XpEvent => ({ key, xp, active, at });

  it("keeps one event per key when two devices award the same thing offline", () => {
    const a = [ev("skill:bc1:pass", 100, true, T1)];
    const b = [ev("skill:bc1:pass", 100, true, T2)];
    const merged = mergeEvents(a, b);
    expect(merged).toHaveLength(1);
    expect(totalXp(merged)).toBe(100);
  });

  it("adds what each device earned on its own", () => {
    const merged = mergeEvents([ev("skill:bc1:pass", 100, true, T1)], [ev("session:2026-11-25", 40, true, T1)]);
    expect(totalXp(merged)).toBe(140);
  });

  it("lets the later change win: an undo that came after the award removes it", () => {
    const merged = mergeEvents([ev("skill:bc1:pass", 100, true, T1)], [ev("skill:bc1:pass", 100, false, T2)]);
    expect(totalXp(merged)).toBe(0);
  });

  it("lets a re-pass that came after the undo win", () => {
    const merged = mergeEvents([ev("skill:bc1:pass", 100, false, T2)], [ev("skill:bc1:pass", 100, true, T3)]);
    expect(totalXp(merged)).toBe(100);
  });

  it("never over-awards on a tie: the switched-off copy wins", () => {
    const merged = mergeEvents([ev("skill:bc1:pass", 100, true, T2)], [ev("skill:bc1:pass", 100, false, T2)]);
    expect(totalXp(merged)).toBe(0);
  });

  it("gives the same result in either order, merged again, and grouped differently", () => {
    const a = [ev("skill:bc1:pass", 100, true, T1), ev("session:2026-11-25", 40, true, T1)];
    const b = [ev("skill:bc1:pass", 100, false, T2), ev("streak:4", 200, true, T2)];
    const c = [ev("skill:bc1:pass", 100, true, T3), ev("session:2026-11-25", 40, false, T2)];
    expect(mergeEvents(a, b)).toEqual(mergeEvents(b, a));
    expect(mergeEvents(mergeEvents(a, b), mergeEvents(a, b))).toEqual(mergeEvents(a, b));
    expect(mergeEvents(mergeEvents(a, b), c)).toEqual(mergeEvents(a, mergeEvents(b, c)));
    expect(totalXp(mergeEvents(mergeEvents(a, b), c))).toBe(100 + 200);
  });

  it("is safe to run against a ledger that already holds the other one's events (a sign-in on a new device)", () => {
    const account = [ev("skill:bc1:pass", 100, true, T1), ev("skill:bc2:pass", 100, true, T2)];
    expect(mergeEvents(account, [])).toEqual(mergeEvents([], account));
    expect(mergeEvents(account, account)).toEqual(cleanEvents(account));
  });
});

describe("cleanEvents", () => {
  it("drops broken entries and keeps the rest, sorted by key", () => {
    const cleaned = cleanEvents([
      { key: "skill:b:pass", xp: 100, active: true, at: T1 },
      { key: "skill:a:pass", xp: 100, active: true, at: T1 },
      { key: "bad key", xp: 100, active: true, at: T1 },
      { key: "skill:c:pass", xp: -1, active: true, at: T1 },
      { key: "skill:d:pass", xp: 1.5, active: true, at: T1 },
      { key: "skill:e:pass", xp: 100, active: "yes", at: T1 },
      { key: "skill:f:pass", xp: 100, active: true, at: "not a date" },
      null,
      "text",
    ]);
    expect(cleaned.map((e) => e.key)).toEqual(["skill:a:pass", "skill:b:pass"]);
    expect(cleanEvents("nope")).toEqual([]);
    expect(cleanEvents(undefined)).toEqual([]);
  });
});

describe("xpLevel", () => {
  it("starts at level 1 and reaches level n at 100 * (n - 1)^2 XP", () => {
    expect(xpLevel(0).level).toBe(1);
    expect(xpLevel(99).level).toBe(1);
    expect(xpLevel(100).level).toBe(2);
    expect(xpLevel(399).level).toBe(2);
    expect(xpLevel(400).level).toBe(3);
    expect(xpLevel(8100).level).toBe(10);
  });

  it("reports how far into the level the player is", () => {
    expect(xpLevel(250)).toEqual({ level: 2, into: 150, span: 300, progress: 0.5 });
    expect(xpLevel(0)).toMatchObject({ level: 1, into: 0, span: 100, progress: 0 });
  });

  it("treats negative and fractional totals sensibly", () => {
    expect(xpLevel(-50).level).toBe(1);
    expect(xpLevel(100.9).level).toBe(2);
  });
});

describe("review fixes (#129)", () => {
  const ev = (key: string, xp: number, active: boolean, at: string): XpEvent => ({ key, xp, active, at });

  it("keeps the smaller amount when two copies of a key disagree, in either order", () => {
    const a = [ev("skill:bc1:pass", 100, true, T1)];
    const b = [ev("skill:bc1:pass", 250, true, T2)];
    expect(mergeEvents(a, b)).toEqual([ev("skill:bc1:pass", 100, true, T2)]);
    expect(mergeEvents(b, a)).toEqual(mergeEvents(a, b));
    expect(mergeEvents(a, [ev("skill:bc1:pass", 250, true, T1)])).toEqual([ev("skill:bc1:pass", 100, true, T1)]);
  });

  it("gives the same merge when the same instant is written two ways", () => {
    const a = [ev("skill:bc1:pass", 100, true, "2026-11-25T10:00:00.000Z")];
    const b = [ev("skill:bc1:pass", 100, true, "2026-11-25T10:00:00+00:00")];
    expect(mergeEvents(a, b)).toEqual(mergeEvents(b, a));
    expect(mergeEvents(a, b)[0]!.at).toBe("2026-11-25T10:00:00.000Z");
  });

  it("stamps a change later than the version it replaces, even when this clock is behind", () => {
    const ahead = "2026-11-25T13:00:00.000Z";
    const events = [ev("skill:bc1:pass", 100, true, ahead)];
    const undone = revoke(events, "skill:bc1:pass", T1);
    expect(Date.parse(undone[0]!.at)).toBeGreaterThan(Date.parse(ahead));
    expect(totalXp(mergeEvents(events, undone))).toBe(0);
    const repassed = award(undone, "skill:bc1:pass", null, T1);
    expect(Date.parse(repassed[0]!.at)).toBeGreaterThan(Date.parse(undone[0]!.at));
    expect(totalXp(mergeEvents(undone, repassed))).toBe(100);
  });

  it("uses the clock when it is already later", () => {
    const undone = revoke([ev("skill:bc1:pass", 100, true, T1)], "skill:bc1:pass", T3);
    expect(undone[0]!.at).toBe(T3);
  });

  it("only pays for the exact keys the builders make", () => {
    expect(amountFor(streakKey(4, null))).toBe(XP_AMOUNTS.streak[4]);
    expect(amountFor(streakKey(4, "2026-11-02"))).toBe(XP_AMOUNTS.streak[4]);
    for (const key of ["streak:4", "streak:04:start", "streak:4.0:start", "streak:4:extra", "streak:+4:start", "skill:bc1:pass:x", "skill:bc1"]) {
      expect(amountFor(key)).toBeNull();
    }
    expect(amountFor(skillPassKey("bc1"))).toBe(XP_AMOUNTS.skill);
  });

  it("sorts by key the same way on every device", () => {
    const keys = cleanEvents(["skill:b:pass", "skill:B:pass", "skill:a:pass"].map((key) => ev(key, 1, true, T1))).map((e) => e.key);
    expect(keys).toEqual(["skill:B:pass", "skill:a:pass", "skill:b:pass"]);
  });

  it("gives level 1 for a total that is not a number", () => {
    for (const total of [NaN, Infinity, -Infinity]) expect(xpLevel(total)).toMatchObject({ level: 1, into: 0 });
  });
});

describe("pass day markers", () => {
  it("are keys worth nothing, only for a real day shape", () => {
    expect(isEventKey(passDayKey("bc1", "2026-11-26"))).toBe(true);
    expect(amountFor(passDayKey("bc1", "2026-11-26"))).toBe(0);
    for (const bad of ["passday:bc1", "passday:bc1:today", "passday:bc1:2026-11-26:x", "passday:bc1:26-11-26"]) expect(amountFor(bad), bad).toBeNull();
  });
});
