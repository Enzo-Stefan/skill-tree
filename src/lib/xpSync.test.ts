// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tree } from "../types";
import { XP_AMOUNTS } from "../data/xp";
import { award, mergeEvents, totalXp, type XpEvent } from "./xp";
import { fetchXp, loadXp, pushXp, reconcile, sameEvents, saveXp } from "./xpSync";

const T1 = "2026-11-25T10:00:00.000Z";
const T2 = "2026-11-25T11:00:00.000Z";
const T3 = "2026-11-25T12:00:00.000Z";

const tree = { id: "football", skills: [{ id: "a" }, { id: "b" }, { id: "c" }] } as unknown as Tree;

describe("reconcile", () => {
  it("awards a pass for every finished skill and a session for every training day", () => {
    const ledger = reconcile(tree, [], ["a", "b"], ["2026-11-24", "2026-11-25"], T1);
    expect(totalXp(ledger)).toBe(2 * XP_AMOUNTS.skill + 2 * XP_AMOUNTS.session);
  });

  it("gives players who already had progress their XP once, and nothing more on later runs", () => {
    const first = reconcile(tree, [], ["a"], ["2026-11-25"], T1);
    const again = reconcile(tree, first, ["a"], ["2026-11-25"], T2);
    expect(again).toBe(first);
  });

  it("takes the XP away when a skill is un-ticked and gives it back, once, when it is ticked again", () => {
    let ledger = reconcile(tree, [], ["a", "b"], [], T1);
    ledger = reconcile(tree, ledger, ["a"], [], T2);
    expect(totalXp(ledger)).toBe(XP_AMOUNTS.skill);
    ledger = reconcile(tree, ledger, ["a", "b"], [], T3);
    expect(totalXp(ledger)).toBe(2 * XP_AMOUNTS.skill);
    expect(ledger.filter((e) => e.key === "skill:b:pass")).toHaveLength(1);
  });

  it("ignores finished skills the tree does not have, and leaves other kinds of events alone", () => {
    const other: XpEvent[] = award([], "streak:4", 200, T1);
    const ledger = reconcile(tree, other, ["ghost"], [], T2);
    expect(ledger).toBe(other);
    expect(totalXp(reconcile(tree, other, [], [], T3))).toBe(200);
  });

  it("does not pay twice when two devices finish the same skill and merge", () => {
    const phone = reconcile(tree, [], ["a"], [], T1);
    const laptop = reconcile(tree, [], ["a"], [], T2);
    expect(totalXp(mergeEvents(phone, laptop))).toBe(XP_AMOUNTS.skill);
  });

  it("follows an undo made on the other device", () => {
    const phone = reconcile(tree, [], ["a"], [], T1);
    const laptop = reconcile(tree, phone, [], [], T2);
    const onPhone = mergeEvents(phone, laptop);
    expect(totalXp(onPhone)).toBe(0);
    expect(reconcile(tree, onPhone, [], [], T3)).toBe(onPhone);
  });
});

describe("this browser's copy", () => {
  beforeEach(() => localStorage.clear());

  it("saves and loads the ledger per tree, and drops anything broken", () => {
    const ledger = award([], "skill:a:pass", 100, T1);
    saveXp("football", ledger);
    expect(loadXp("football")).toEqual(ledger);
    expect(loadXp("weights")).toEqual([]);
    localStorage.setItem("skill-tree:football:xp", "not json");
    expect(loadXp("football")).toEqual([]);
    localStorage.setItem("skill-tree:football:xp", JSON.stringify([{ key: "bad key", xp: 1, active: true, at: T1 }]));
    expect(loadXp("football")).toEqual([]);
  });
});

describe("the account's copy", () => {
  it("reads the rows as events", async () => {
    const eq = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [{ event_key: "skill:a:pass", xp: 100, active: true, at: T1 }], error: null }) });
    const client = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) }) } as unknown as SupabaseClient;
    expect(await fetchXp(client, "football")).toEqual([{ key: "skill:a:pass", xp: 100, active: true, at: T1 }]);
    expect(eq).toHaveBeenCalledWith("tree_id", "football");
  });

  it("throws when the read fails, so the caller keeps its own copy", async () => {
    const client = { from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: null, error: { message: "relation does not exist" } }) }) }) }) } as unknown as SupabaseClient;
    await expect(fetchXp(client, "football")).rejects.toThrow(/does not exist/);
  });

  it("sends events 500 at a time, and nothing when there are none", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const client = { rpc } as unknown as SupabaseClient;
    const many = Array.from({ length: 1201 }, (_, i) => ({ key: `skill:s${i}:pass`, xp: 1, active: true, at: T1 }));
    await pushXp(client, "football", many);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls.map((c) => c[1].p_events.length)).toEqual([500, 500, 201]);
    expect(rpc.mock.calls[0]![0]).toBe("save_xp_events");
    rpc.mockClear();
    await pushXp(client, "football", []);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("throws when a save fails", async () => {
    const client = { rpc: async () => ({ error: { message: "Sign in to save XP." } }) } as unknown as SupabaseClient;
    await expect(pushXp(client, "football", [{ key: "skill:a:pass", xp: 1, active: true, at: T1 }])).rejects.toThrow(/Sign in/);
  });
});

describe("sameEvents", () => {
  const a: XpEvent = { key: "skill:a:pass", xp: 100, active: true, at: T1 };
  it("compares by key and content, not order", () => {
    const b: XpEvent = { key: "skill:b:pass", xp: 100, active: true, at: T1 };
    expect(sameEvents([a, b], [b, a])).toBe(true);
    expect(sameEvents([a], [{ ...a, active: false }])).toBe(false);
    expect(sameEvents([a], [{ ...a, at: T2 }])).toBe(false);
    expect(sameEvents([a], [a, b])).toBe(false);
  });
});
