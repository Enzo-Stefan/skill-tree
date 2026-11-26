import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanEvents, mergeEvents, type XpEvent } from "../../src/lib/xp";

// Migration 009 replaces save_xp_events() from 007. These tests run 007 then 009 in an in-memory Postgres and check
// the three problems found when 007 was reviewed (#129): the amount, the time and the tree id.

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
const T1 = "2026-11-25T10:00:00.000Z";
const T2 = "2026-11-25T11:00:00.000Z";
const T3 = "2026-11-25T12:00:00.000Z";
let db: PGlite;

const ev = (key: string, xp: number, active: boolean, at: string): XpEvent => ({ key, xp, active, at });

async function save(events: unknown, tree = "football", n = 1): Promise<number> {
  await db.query(`select set_config('test.uid', $1, false)`, [id(n)]);
  const r = await db.query<{ save_xp_events: number }>("select public.save_xp_events($1, $2::jsonb)", [tree, JSON.stringify(events)]);
  return r.rows[0]!.save_xp_events;
}

async function rows(tree = "football"): Promise<XpEvent[]> {
  const r = await db.query<{ key: string; xp: number; active: boolean; at: string }>(
    "select event_key as key, xp, active, to_char(at at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as at from public.xp_events where tree_id = $1 order by event_key",
    [tree],
  );
  return r.rows;
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(sql("007_xp.sql"));
  await db.exec(sql("009_xp_fixes.sql"));
  await db.query("insert into auth.users (id) values ($1), ($2)", [id(1), id(2)]);
});

describe("the amount", () => {
  it("keeps the smaller amount, whichever order the saves arrive in", async () => {
    await save([ev("skill:bc1:pass", 100, true, T1)]);
    await save([ev("skill:bc1:pass", 250, true, T2)]);
    expect(await rows()).toEqual([ev("skill:bc1:pass", 100, true, T2)]);

    await save([ev("skill:bc2:pass", 250, true, T1)], "football", 2);
    await save([ev("skill:bc2:pass", 100, true, T2)], "football", 2);
    await db.query(`select set_config('test.uid', $1, false)`, [id(2)]);
    expect((await db.query("select xp from public.xp_events where user_id = $1", [id(2)])).rows).toEqual([{ xp: 100 }]);
  });

  it("lowers the amount even when the incoming copy is older", async () => {
    await save([ev("skill:bc1:pass", 250, false, T2)]);
    expect(await save([ev("skill:bc1:pass", 100, true, T1)])).toBe(1);
    expect(await rows()).toEqual([ev("skill:bc1:pass", 100, false, T2)]);
  });

  it("changes nothing when nothing would change", async () => {
    await save([ev("skill:bc1:pass", 100, true, T2)]);
    expect(await save([ev("skill:bc1:pass", 100, true, T2)])).toBe(0);
    expect(await save([ev("skill:bc1:pass", 100, true, T1)])).toBe(0);
    expect(await save([ev("skill:bc1:pass", 400, true, T1)])).toBe(0);
  });

  it("ends with exactly what the app's merge gives, however the copies were saved", async () => {
    const a = [ev("skill:bc1:pass", 100, true, T1), ev("session:2026-11-25", 40, true, T3), ev("streak:4", 200, false, T2)];
    const b = [ev("skill:bc1:pass", 250, true, T2), ev("session:2026-11-25", 40, false, T2), ev("streak:4", 100, true, T2)];
    for (const order of [[a, b], [b, a]]) {
      await db.query("delete from public.xp_events");
      await save(order[0]!);
      await save(order[1]!);
      expect(await rows()).toEqual(mergeEvents(a, b));
    }
  });
});

describe("the time", () => {
  it("skips a time that is not a real date", async () => {
    const saved = await save([
      ev("skill:a:pass", 100, true, "infinity"),
      ev("skill:b:pass", 100, true, "-infinity"),
      { key: "skill:c:pass", xp: 100, active: true },
      { key: "skill:d:pass", xp: 100, active: true, at: 5 },
      { key: "skill:e:pass", xp: 100, active: true, at: "not a date" },
      ev("skill:ok:pass", 100, true, T1),
    ]);
    expect(saved).toBe(1);
    expect((await rows()).map((r) => r.key)).toEqual(["skill:ok:pass"]);
  });

  it("stores a time in the future as the server's own time, so it cannot freeze the key", async () => {
    await save([ev("skill:bc1:pass", 100, true, "9999-01-01T00:00:00.000Z")]);
    const stored = (await rows())[0]!;
    expect(Date.parse(stored.at)).toBeLessThanOrEqual(Date.now() + 60_000);
    // A real later change from another device still beats it.
    await save([ev("skill:bc1:pass", 100, false, new Date(Date.now() + 60_000).toISOString())]);
    expect((await rows())[0]!.active).toBe(false);
  });

  it("treats the words Postgres reads as times ('now', 'today') as real times, never in the future", async () => {
    expect(await save([ev("skill:a:pass", 100, true, "now"), ev("skill:b:pass", 100, true, "today")])).toBe(2);
    // They are real, finite times (stored as the server's clock at most), so nothing is frozen.
    for (const r of await rows()) expect(Date.parse(r.at)).toBeLessThanOrEqual(Date.now() + 60_000);
  });
});

describe("the tree", () => {
  it("accepts the trees that exist and refuses made-up ones", async () => {
    expect(await save([ev("skill:bc1:pass", 100, true, T1)], "football")).toBe(1);
    expect(await save([ev("skill:bc1:pass", 100, true, T1)], "weights")).toBe(1);
    await db.query(`select set_config('test.uid', $1, false)`, [id(1)]);
    for (const tree of ["made-up-1", "Football", "football ", ""]) {
      await expect(db.query("select public.save_xp_events($1, '[]'::jsonb)", [tree])).rejects.toThrow(/Unknown tree/);
    }
    await expect(db.query("select public.save_xp_events(null, '[]'::jsonb)")).rejects.toThrow(/Unknown tree/);
  });
});

describe("what still works", () => {
  it("skips broken events and keeps the good ones", async () => {
    const saved = await save([
      ev("skill:ok:pass", 100, true, T1),
      ev("BAD KEY", 100, true, T1),
      ev("skill:x:pass", -5, true, T1),
      ev("skill:y:pass", 99999, true, T1),
      { xp: 100, active: true, at: T1 },
      { key: "skill:z:pass", active: true, at: T1 },
      "text",
      null,
    ]);
    expect(saved).toBe(1);
  });

  it("keeps the app's cleaned copy and the database in step", async () => {
    const events = [ev("skill:bc1:pass", 100, true, T1), ev("streak:4", 200, true, T2)];
    await save(events);
    expect(await rows()).toEqual(cleanEvents(events).sort((a, b) => (a.key < b.key ? -1 : 1)));
  });

  it("can be run twice", async () => {
    await db.exec(sql("009_xp_fixes.sql"));
    expect(await save([ev("skill:bc1:pass", 100, true, T1)])).toBe(1);
  });
});
