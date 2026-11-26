import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

// Runs migration 007 in an in-memory Postgres and checks the XP ledger rules (#121): a key pays once, the later
// change wins, nobody but the owner can read or write, and bad events are skipped.

const sql = (file: string) => readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8");

const AUTH_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon; create role authenticated;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const T1 = "2026-11-25T10:00:00Z";
const T2 = "2026-11-25T11:00:00Z";
const T3 = "2026-11-25T12:00:00Z";
let db: PGlite;

async function as(n: number | null) {
  await db.query(`select set_config('test.uid', $1, false)`, [n === null ? "" : id(n)]);
}

async function save(n: number, events: unknown, tree = "football"): Promise<number> {
  await as(n);
  const r = await db.query<{ save_xp_events: number }>("select public.save_xp_events($1, $2::jsonb)", [tree, JSON.stringify(events)]);
  return r.rows[0]!.save_xp_events;
}

async function rows(n = 1) {
  const r = await db.query<{ event_key: string; xp: number; active: boolean }>(
    "select event_key, xp, active from public.xp_events where user_id = $1 order by event_key",
    [id(n)],
  );
  return r.rows;
}

const ev = (key: string, xp: number, active: boolean, at: string) => ({ key, xp, active, at });

beforeEach(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(sql("007_xp.sql"));
  await db.query("insert into auth.users (id) values ($1), ($2)", [id(1), id(2)]);
});

describe("one row per key", () => {
  it("stores an event once however many times it is saved", async () => {
    expect(await save(1, [ev("skill:bc1:pass", 100, true, T1)])).toBe(1);
    expect(await save(1, [ev("skill:bc1:pass", 100, true, T1)])).toBe(0);
    expect(await save(1, [ev("skill:bc1:pass", 100, true, T2)])).toBe(1);
    expect(await rows()).toEqual([{ event_key: "skill:bc1:pass", xp: 100, active: true }]);
  });

  it("rejects a duplicate key outright when written around the function", async () => {
    await db.query("insert into public.xp_events values ($1, 'football', 'skill:bc1:pass', 100, true, $2)", [id(1), T1]);
    await expect(db.query("insert into public.xp_events values ($1, 'football', 'skill:bc1:pass', 100, true, $2)", [id(1), T2])).rejects.toThrow(/duplicate key|unique/i);
  });

  it("keeps trees and players apart", async () => {
    await save(1, [ev("skill:bc1:pass", 100, true, T1)]);
    await save(1, [ev("skill:bc1:pass", 100, true, T1)], "weights");
    await save(2, [ev("skill:bc1:pass", 100, true, T1)]);
    expect((await db.query("select 1 from public.xp_events")).rows).toHaveLength(3);
  });
});

describe("the later change wins", () => {
  it("lets an undo that came later switch the XP off, and a re-pass after that switch it on", async () => {
    await save(1, [ev("skill:bc1:pass", 100, true, T1)]);
    await save(1, [ev("skill:bc1:pass", 100, false, T2)]);
    expect((await rows())[0]!.active).toBe(false);
    await save(1, [ev("skill:bc1:pass", 100, true, T3)]);
    expect((await rows())[0]!.active).toBe(true);
  });

  it("ignores an older change that arrives late from another device", async () => {
    await save(1, [ev("skill:bc1:pass", 100, false, T3)]);
    expect(await save(1, [ev("skill:bc1:pass", 100, true, T1)])).toBe(0);
    expect((await rows())[0]!.active).toBe(false);
  });

  it("never over-awards on a tie: switched off beats switched on at the same instant", async () => {
    await save(1, [ev("skill:bc1:pass", 100, true, T2)]);
    await save(1, [ev("skill:bc1:pass", 100, false, T2)]);
    expect((await rows())[0]!.active).toBe(false);
    expect(await save(1, [ev("skill:bc1:pass", 100, true, T2)])).toBe(0);
  });

  it("keeps the amount the event was first awarded for", async () => {
    await save(1, [ev("skill:bc1:pass", 100, true, T1)]);
    await save(1, [ev("skill:bc1:pass", 250, false, T2)]);
    expect((await rows())[0]!.xp).toBe(100);
  });
});

describe("bad input", () => {
  it("skips broken events and still saves the good ones in the same batch", async () => {
    const saved = await save(1, [
      ev("skill:bc1:pass", 100, true, T1),
      ev("BAD KEY", 100, true, T1),
      ev("skill:bc2:pass", -5, true, T1),
      ev("skill:bc3:pass", 99999, true, T1),
      ev("skill:bc4:pass", 1.5, true, T1),
      { key: "skill:bc5:pass", xp: 100, active: "yes", at: T1 },
      { key: "skill:bc6:pass", xp: 100, active: true, at: "not a date" },
      { key: "x:" + "y".repeat(120), xp: 1, active: true, at: T1 },
      "text",
      null,
    ]);
    expect(saved).toBe(1);
    expect((await rows()).map((r) => r.event_key)).toEqual(["skill:bc1:pass"]);
  });

  it("refuses a non-list, a batch over 500 and a bad tree id", async () => {
    await as(1);
    await expect(db.query("select public.save_xp_events('football', '{}'::jsonb)")).rejects.toThrow(/at most 500/);
    const big = JSON.stringify(Array.from({ length: 501 }, (_, i) => ev(`skill:s${i}:pass`, 1, true, T1)));
    await expect(db.query("select public.save_xp_events('football', $1::jsonb)", [big])).rejects.toThrow(/at most 500/);
    await expect(db.query("select public.save_xp_events('', '[]'::jsonb)")).rejects.toThrow(/Unknown tree/);
  });

  it("refuses a signed-out caller", async () => {
    await as(null);
    await expect(db.query("select public.save_xp_events('football', '[]'::jsonb)")).rejects.toThrow(/Sign in/);
  });
});

describe("who can read and write", () => {
  it("lets a player read only their own rows and not write directly", async () => {
    await save(1, [ev("skill:bc1:pass", 100, true, T1)]);
    await save(2, [ev("skill:bc2:pass", 100, true, T1)]);
    await as(1);
    await db.exec("set role authenticated");
    try {
      expect((await db.query<{ event_key: string }>("select event_key from public.xp_events")).rows).toEqual([{ event_key: "skill:bc1:pass" }]);
      await expect(db.query("insert into public.xp_events values ($1, 'football', 'skill:zz:pass', 100, true, now())", [id(1)])).rejects.toThrow(/permission denied/);
      await expect(db.query("update public.xp_events set xp = 10000")).rejects.toThrow(/permission denied/);
      await expect(db.query("delete from public.xp_events")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });

  it("gives signed-out callers no access", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from public.xp_events")).rejects.toThrow(/permission denied/);
      await expect(db.query("select public.save_xp_events('football', '[]'::jsonb)")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });

  it("removes a player's events when their account is deleted", async () => {
    await save(1, [ev("skill:bc1:pass", 100, true, T1)]);
    await db.query("delete from auth.users where id = $1", [id(1)]);
    expect(await rows()).toHaveLength(0);
  });

  it("can be run twice", async () => {
    await save(1, [ev("skill:bc1:pass", 100, true, T1)]);
    await db.exec(sql("007_xp.sql"));
    expect(await rows()).toHaveLength(1);
  });
});
