import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

// Runs 001, 008 and 010 in an in-memory Postgres: the fixes to the player card grant and save_rating_snapshots (#136 review).

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
const MON = "2026-11-23";
let db: PGlite;

async function as(n: number | null) {
  await db.query(`select set_config('test.uid', $1, false)`, [n === null ? "" : id(n)]);
}

const snap = (week: string, overall: number, at: string) => ({ week, ratings: { bc: overall }, overall, at });

async function save(n: number, snaps: unknown, tree = "football"): Promise<number> {
  await as(n);
  const r = await db.query<{ save_rating_snapshots: number }>("select public.save_rating_snapshots($1, $2::jsonb)", [tree, JSON.stringify(snaps)]);
  return r.rows[0]!.save_rating_snapshots;
}

const rows = async () => (await db.query<{ week: string; overall: number; at: string }>("select week::text, overall, at::text from public.rating_snapshots order by week")).rows;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(sql("001_progress.sql"));
  await db.exec(sql("008_ratings.sql"));
  await db.exec(sql("010_ratings_fixes.sql"));
  await db.query("insert into auth.users (id) values ($1), ($2)", [id(1), id(2)]);
});

describe("player card upsert", () => {
  it("saves a new card and then an existing one the way the app does (user_id in the update)", async () => {
    await as(1);
    await db.exec("set role authenticated");
    try {
      const up = (pos: string) =>
        db.query("insert into public.player_cards (user_id, player_position) values ($1, $2) on conflict (user_id) do update set user_id = excluded.user_id, player_position = excluded.player_position", [id(1), pos]);
      await up("MID");
      await up("FWD");
      expect((await db.query("select player_position from public.player_cards")).rows).toEqual([{ player_position: "FWD" }]);
    } finally {
      await db.exec("reset role");
    }
  });

  it("still does not let a player move their card to another account", async () => {
    await as(1);
    await db.exec("set role authenticated");
    try {
      await db.query("insert into public.player_cards (user_id, player_position) values ($1, 'GK')", [id(1)]);
      await expect(db.query("update public.player_cards set user_id = $1", [id(2)])).rejects.toThrow(/row-level security/);
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("save_rating_snapshots after 010", () => {
  it("skips an infinite or non-Monday or out-of-range week and keeps the good one", async () => {
    const n = await save(1, [
      snap("infinity", 1, T1),
      snap("-infinity", 1, T1),
      snap("2026-11-24", 1, T1),
      snap("9999-01-05", 1, T1),
      snap("2019-12-30", 1, T1),
      snap(MON, 5, T1),
    ]);
    expect(n).toBe(1);
    expect((await rows()).map((r) => r.week)).toEqual([MON]);
  });

  it("skips an infinite time, so it cannot freeze a week", async () => {
    expect(await save(1, [snap(MON, 5, "infinity")])).toBe(0);
    await save(1, [snap(MON, 5, T1)]);
    expect(await save(1, [snap(MON, 9, T2)])).toBe(1);
  });

  it("stores a future time as the server clock, so a later honest save still wins", async () => {
    await save(1, [snap(MON, 5, "2099-01-01T00:00:00Z")]);
    const { rows: r } = await db.query<{ ms: number }>("select (extract(epoch from at) * 1000)::float8 as ms from public.rating_snapshots");
    const stored = { getTime: () => r[0]!.ms };
    expect(stored.getTime()).toBeLessThan(Date.now() + 60_000);
    expect(await save(1, [snap(MON, 9, new Date(Date.now() + 1000).toISOString())])).toBe(1);
  });

  it("accepts only trees that exist", async () => {
    await as(1);
    await expect(db.query("select public.save_rating_snapshots('made-up', '[]'::jsonb)")).rejects.toThrow(/Unknown tree/);
    expect(await save(1, [snap(MON, 5, T1)], "weights")).toBe(1);
  });

  it("skips a snapshot with a missing or non-text week or time", async () => {
    expect(await save(1, [{ ratings: { bc: 1 }, overall: 1, at: T1 }, { week: 5, ratings: { bc: 1 }, overall: 1, at: T1 }, { week: MON, ratings: { bc: 1 }, overall: 1 }])).toBe(0);
  });

  it("can be run twice", async () => {
    await save(1, [snap(MON, 5, T1)]);
    await db.exec(sql("010_ratings_fixes.sql"));
    expect(await rows()).toHaveLength(1);
  });
});
