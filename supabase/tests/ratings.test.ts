import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

// Runs 001 and 008 in an in-memory Postgres: the private player card fields and the weekly rating snapshots (#123).

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

const snap = (week: string, overall: number, at: string, ratings: Record<string, unknown> = { bc: overall, ps: 0 }) => ({ week, ratings, overall, at });

async function save(n: number, snaps: unknown, tree = "football"): Promise<number> {
  await as(n);
  const r = await db.query<{ save_rating_snapshots: number }>("select public.save_rating_snapshots($1, $2::jsonb)", [tree, JSON.stringify(snaps)]);
  return r.rows[0]!.save_rating_snapshots;
}

const rows = async (n = 1) => (await db.query<{ week: string; overall: number }>("select week::text, overall from public.rating_snapshots where user_id = $1 order by week", [id(n)])).rows;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  await db.exec(sql("001_progress.sql"));
  await db.exec(sql("008_ratings.sql"));
  await db.query("insert into auth.users (id) values ($1), ($2)", [id(1), id(2)]);
});

describe("rating snapshots", () => {
  it("stores one row per player, tree and week", async () => {
    expect(await save(1, [snap(MON, 5, T1)])).toBe(1);
    expect(await save(1, [snap("2026-11-30", 7, T1)])).toBe(1);
    expect(await rows()).toEqual([{ week: MON, overall: 5 }, { week: "2026-11-30", overall: 7 }]);
    await save(1, [snap(MON, 5, T1)], "weights");
    expect((await db.query("select 1 from public.rating_snapshots")).rows).toHaveLength(3);
  });

  it("replaces a week only with a later change, and ignores an older one", async () => {
    await save(1, [snap(MON, 5, T1)]);
    expect(await save(1, [snap(MON, 9, T2)])).toBe(1);
    expect((await rows())[0]!.overall).toBe(9);
    expect(await save(1, [snap(MON, 1, T1)])).toBe(0);
    expect((await rows())[0]!.overall).toBe(9);
    expect(await save(1, [snap(MON, 2, T2)])).toBe(0);
  });

  it("skips bad snapshots and still saves the good ones", async () => {
    const saved = await save(1, [
      snap(MON, 5, T1),
      snap("2026-11-24", 5, T1),
      snap("not a date", 5, T1),
      snap("2026-11-30", 150, T1),
      snap("2026-12-07", 5, T1, { bc: 120 }),
      snap("2026-12-14", 5, T1, { bc: "high" }),
      snap("2026-12-21", 5, T1, { "BAD KEY": 5 }),
      snap("2026-12-28", 5, T1, Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`b${i}`, 1]))),
      { week: "2027-01-04", ratings: { bc: 5 }, overall: 5, at: "nonsense" },
      "text",
      null,
    ]);
    expect(saved).toBe(1);
    expect(await rows()).toEqual([{ week: MON, overall: 5 }]);
  });

  it("refuses a non-list, a batch over 300, a bad tree and a signed-out caller", async () => {
    await as(1);
    await expect(db.query("select public.save_rating_snapshots('football', '{}'::jsonb)")).rejects.toThrow(/at most 300/);
    const big = JSON.stringify(Array.from({ length: 301 }, () => snap(MON, 1, T1)));
    await expect(db.query("select public.save_rating_snapshots('football', $1::jsonb)", [big])).rejects.toThrow(/at most 300/);
    await expect(db.query("select public.save_rating_snapshots('', '[]'::jsonb)")).rejects.toThrow(/Unknown tree/);
    await as(null);
    await expect(db.query("select public.save_rating_snapshots('football', '[]'::jsonb)")).rejects.toThrow(/Sign in/);
  });

  it("lets a player read only their own snapshots and not write directly", async () => {
    await save(1, [snap(MON, 5, T1)]);
    await save(2, [snap(MON, 8, T1)]);
    await as(1);
    await db.exec("set role authenticated");
    try {
      expect((await db.query<{ overall: number }>("select overall from public.rating_snapshots")).rows).toEqual([{ overall: 5 }]);
      await expect(db.query("insert into public.rating_snapshots values ($1, 'football', '2026-11-30', '{}', 99, now())", [id(1)])).rejects.toThrow(/permission denied/);
      await expect(db.query("update public.rating_snapshots set overall = 99")).rejects.toThrow(/permission denied/);
      await expect(db.query("delete from public.rating_snapshots")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });

  it("is removed with the account", async () => {
    await save(1, [snap(MON, 5, T1)]);
    await db.query("delete from auth.users where id = $1", [id(1)]);
    expect(await rows()).toHaveLength(0);
  });
});

describe("player cards", () => {
  it("lets a player write their own position and foot, and read only their own", async () => {
    await as(1);
    await db.exec("set role authenticated");
    try {
      await db.query("insert into public.player_cards (user_id, player_position, preferred_foot) values ($1, 'MID', 'left')", [id(1)]);
      await db.query("update public.player_cards set player_position = 'FWD', preferred_foot = 'both' where user_id = $1", [id(1)]);
      expect((await db.query("select player_position, preferred_foot from public.player_cards")).rows).toEqual([{ player_position: "FWD", preferred_foot: "both" }]);
      await as(2);
      expect((await db.query("select * from public.player_cards")).rows).toHaveLength(0);
      await expect(db.query("insert into public.player_cards (user_id, player_position) values ($1, 'GK')", [id(1)])).rejects.toThrow(/row-level security/);
    } finally {
      await db.exec("reset role");
    }
  });

  it("refuses values outside the lists, and anon has no access", async () => {
    await expect(db.query("insert into public.player_cards (user_id, player_position) values ($1, 'STRIKER')", [id(1)])).rejects.toThrow();
    await expect(db.query("insert into public.player_cards (user_id, preferred_foot) values ($1, 'middle')", [id(1)])).rejects.toThrow();
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from public.player_cards")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.rating_snapshots")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });

  it("does not let a player set updated_at, and the trigger sets it", async () => {
    await as(1);
    await db.exec("set role authenticated");
    try {
      await db.query("insert into public.player_cards (user_id, player_position) values ($1, 'GK')", [id(1)]);
      await expect(db.query("update public.player_cards set updated_at = now() - interval '1 year'")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });

  it("is removed with the account", async () => {
    await db.query("insert into public.player_cards (user_id, player_position) values ($1, 'GK')", [id(1)]);
    await db.query("delete from auth.users where id = $1", [id(1)]);
    expect((await db.query("select 1 from public.player_cards")).rows).toHaveLength(0);
  });

  it("can be run twice", async () => {
    await save(1, [snap(MON, 5, T1)]);
    await db.exec(sql("008_ratings.sql"));
    expect(await rows()).toHaveLength(1);
  });
});
