import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import {
  cleanSessions,
  loadSessions,
  MAX_SESSION_ENTRIES,
  mergeSessions,
  replaySessions,
  saveSessions,
  sessionKeys,
  setSkillsOn,
  skillHistory,
  skillsOn,
  type SessionEntry,
} from "./sessions";

const on = (date: string, ...skillIds: string[]): SessionEntry[] => skillIds.map((skillId) => ({ date, skillId }));

describe("keeping sessions", () => {
  it("drops unknown skills, made-up days, duplicates and anything broken", () => {
    const raw = [
      ...on("2026-11-20", "bc1", "bc1", "gone"),
      { date: "2026-02-31", skillId: "bc1" },
      { date: "2026-11-21" },
      null,
      "bc1",
    ];
    expect(cleanSessions(football, raw)).toEqual(on("2026-11-20", "bc1"));
    expect(cleanSessions(football, { not: "a list" })).toEqual([]);
  });

  it("sorts by day, then by the skill's place in the tree", () => {
    const raw = [...on("2026-11-21", "ps1"), ...on("2026-11-20", "ps1", "root")];
    expect(cleanSessions(football, raw)).toEqual([...on("2026-11-20", "root", "ps1"), ...on("2026-11-21", "ps1")]);
  });

  it("keeps only the newest entries when there are too many", () => {
    const many = Array.from({ length: MAX_SESSION_ENTRIES + 10 }, (_, i) => {
      const d = new Date(Date.UTC(2000, 0, 1 + i));
      return { date: d.toISOString().slice(0, 10), skillId: "root" };
    });
    const kept = cleanSessions(football, many);
    expect(kept).toHaveLength(MAX_SESSION_ENTRIES);
    expect(kept[0].date).toBe(many[10].date);
  });
});

describe("a day's skills", () => {
  const base = [...on("2026-11-20", "bc1", "ps1"), ...on("2026-11-21", "dr1")];

  it("reads the skills trained on a day", () => {
    expect(skillsOn(base, "2026-11-20")).toEqual(["bc1", "ps1"]);
    expect(skillsOn(base, "2026-11-22")).toEqual([]);
  });

  it("sets a day to exactly the ticked skills, leaving other days alone", () => {
    const next = setSkillsOn(football, base, "2026-11-20", ["sh1", "bc1"]);
    expect(skillsOn(next, "2026-11-20")).toEqual(["bc1", "sh1"]);
    expect(skillsOn(next, "2026-11-21")).toEqual(["dr1"]);
  });

  it("clears a day with an empty list", () => {
    expect(skillsOn(setSkillsOn(football, base, "2026-11-20", []), "2026-11-20")).toEqual([]);
  });

  it("counts the days a skill was trained, and the last one", () => {
    const history = [...on("2026-11-18", "bc1"), ...on("2026-11-20", "bc1"), ...on("2026-11-19", "ps1")];
    expect(skillHistory(history, "bc1")).toEqual({ days: 2, last: "2026-11-20" });
    expect(skillHistory(history, "sh1")).toEqual({ days: 0, last: null });
  });
});

describe("syncing sessions", () => {
  it("first sign-in keeps every pair from both, once", () => {
    const here = on("2026-11-20", "bc1", "ps1");
    const account = [...on("2026-11-20", "bc1"), ...on("2026-11-19", "dr1")];
    expect(sessionKeys(mergeSessions(football, here, account))).toEqual(["2026-11-19|dr1", "2026-11-20|bc1", "2026-11-20|ps1"]);
  });

  it("replays ticks and un-ticks made here, keeping other devices' pairs", () => {
    const base = on("2026-11-20", "bc1", "ps1");
    const account = [...base, ...on("2026-11-21", "dr1")];
    const here = [...on("2026-11-20", "bc1"), ...on("2026-11-22", "sh1")];
    expect(sessionKeys(replaySessions(football, account, base, here))).toEqual(["2026-11-20|bc1", "2026-11-21|dr1", "2026-11-22|sh1"]);
  });

  it("doesn't bring back a skill un-ticked on another device, and replaying twice changes nothing", () => {
    const base = on("2026-11-20", "bc1", "ps1");
    const account = on("2026-11-20", "bc1");
    expect(sessionKeys(replaySessions(football, account, base, base))).toEqual(["2026-11-20|bc1"]);
    const here = [...base, ...on("2026-11-22", "sh1")];
    const once = replaySessions(football, account, base, here);
    expect(replaySessions(football, once, base, here)).toEqual(once);
  });
});

describe("storage", () => {
  it("saves and loads per tree, cleaning on the way in", () => {
    const store = new Map<string, string>();
    const real = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
    try {
      saveSessions(football.id, [...on("2026-11-20", "bc1"), { date: "2026-11-20", skillId: "gone" }]);
      expect(loadSessions(football)).toEqual(on("2026-11-20", "bc1"));
      store.set("skill-tree:football:sessions", "not json");
      expect(loadSessions(football)).toEqual([]);
    } finally {
      globalThis.localStorage = real;
    }
  });
});
