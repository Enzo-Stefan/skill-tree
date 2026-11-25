import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { football } from "../../src/data/football";

// Runs the real migrations (001, 003, 005) in an in-memory Postgres, with a stand-in for Supabase's
// auth schema, and checks the ranking, ties, scopes, privacy and cheating limits (#96).

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
let db: PGlite;

async function setup() {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  for (const f of ["001_progress.sql", "003_lift_log_and_results.sql", "005_leaderboard.sql"]) await db.exec(sql(f));
}

interface Player {
  n: number;
  name: string;
  skills?: number;
  level?: string;
  step?: number;
  sprint?: number;
  country?: string | null;
  hemisphere?: string | null;
  city?: string | null;
  optIn?: boolean;
  results?: { skillId: string; date: string; value: number }[];
}

async function addPlayer(p: Player) {
  await db.query("insert into auth.users (id) values ($1)", [id(p.n)]);
  await db.query(
    `insert into public.profiles (user_id, display_name, country_code, city, hemisphere, leaderboard_opt_in)
     values ($1, $2, $3, $4, $5, $6)`,
    [id(p.n), p.name, p.country ?? null, p.city ?? null, p.hemisphere ?? null, p.optIn ?? true],
  );
  const results = p.results ?? (p.sprint ? [{ skillId: "ft2", date: "2026-11-01", value: p.sprint }] : []);
  await db.query(
    `insert into public.progress (user_id, tree_id, done, player_level, player_step, results)
     values ($1, 'football', $2, $3, $4, $5)`,
    [id(p.n), football.skills.slice(0, p.skills ?? 0).map((sk) => sk.id), p.level ?? "beginner", p.step ?? 1, JSON.stringify(results)],
  );
}

async function board(asUser: number, scope = "global", test: string | null = null) {
  await db.query(`select set_config('test.uid', $1, false)`, [id(asUser)]);
  const r = await db.query<{ display_name: string; rank: number; is_me: boolean; best_sprint: string | null; country_code: string | null }>(
    "select * from public.leaderboard($1, 'football', $2)",
    [scope, test],
  );
  return r.rows.map((row) => ({ ...row, place: Number(row.rank) }));
}

beforeEach(setup);

describe("score order", () => {
  it("ranks skills first, then level step, then the faster sprint", async () => {
    await addPlayer({ n: 1, name: "FewSkillsHighLevel", skills: 5, level: "expert", step: 4, sprint: 4 });
    await addPlayer({ n: 2, name: "BeginnerMoreSkills", skills: 9, level: "beginner", step: 1, sprint: 9 });
    await addPlayer({ n: 3, name: "AdvancedSlower", skills: 9, level: "advanced", step: 2, sprint: 9 });
    await addPlayer({ n: 4, name: "AdvancedFaster", skills: 9, level: "advanced", step: 2, sprint: 5 });
    await addPlayer({ n: 5, name: "AdvancedNoSprint", skills: 9, level: "advanced", step: 2 });
    const rows = await board(1);
    expect(rows.map((r) => r.display_name)).toEqual(["AdvancedFaster", "AdvancedSlower", "AdvancedNoSprint", "BeginnerMoreSkills", "FewSkillsHighLevel"]);
  });

  it("gives tied players the same rank and skips the next one", async () => {
    await addPlayer({ n: 1, name: "Ana", skills: 8, sprint: 5 });
    await addPlayer({ n: 2, name: "Bea", skills: 8, sprint: 5 });
    await addPlayer({ n: 3, name: "Cleo", skills: 3 });
    const rows = await board(3);
    expect(rows.map((r) => [r.display_name, r.place])).toEqual([["Ana", 1], ["Bea", 1], ["Cleo", 3]]);
  });

  it("computes the level step from level and step (1 to 16)", async () => {
    await addPlayer({ n: 1, name: "Top", level: "expert", step: 4 });
    await addPlayer({ n: 2, name: "Bottom", level: "beginner", step: 1 });
    await addPlayer({ n: 3, name: "Mid", level: "intermediate", step: 2 });
    const r = await db.query<{ level_step: number }>("select level_step from public.leaderboard_scores order by user_id");
    expect(r.rows.map((x) => x.level_step)).toEqual([16, 1, 6]);
  });
});

describe("who appears", () => {
  it("leaves out players who haven't joined, and brings them back after joining", async () => {
    await addPlayer({ n: 1, name: "Visible", skills: 2 });
    await addPlayer({ n: 2, name: "Hidden", skills: 9, optIn: false });
    expect((await board(1)).map((r) => r.display_name)).toEqual(["Visible"]);
    await db.query("update public.profiles set leaderboard_opt_in = true where user_id = $1", [id(2)]);
    expect((await board(1)).map((r) => r.display_name)).toEqual(["Hidden", "Visible"]);
  });

  it("refuses signed-out callers", async () => {
    await addPlayer({ n: 1, name: "Visible" });
    await db.query(`select set_config('test.uid', '', false)`);
    await expect(db.query("select * from public.leaderboard('global', 'football')")).rejects.toThrow(/Sign in/);
  });

  it("refuses unknown scopes and tests that can't be ranked alone", async () => {
    await addPlayer({ n: 1, name: "Visible" });
    await expect(board(1, "nonsense")).rejects.toThrow(/Unknown scope/);
    await expect(board(1, "global", "ft9")).rejects.toThrow(/sprint/);
  });

  it("returns the top 50 plus the caller's own row, even at 4000th", async () => {
    for (let i = 1; i <= 60; i++) await addPlayer({ n: i, name: `Player${String(i).padStart(2, "0")}`, skills: 61 - i > 32 ? 32 : 61 - i });
    const rows = await board(60);
    expect(rows).toHaveLength(51);
    expect(rows[50].is_me).toBe(true);
    expect(rows[50].display_name).toBe("Player60");
    expect((await board(1)).filter((r) => r.is_me)).toHaveLength(1);
    expect(await board(1)).toHaveLength(50);
  });

  it("never returns a city", async () => {
    const cols = await db.query<{ column_name: string }>(
      "select a.attname as column_name from pg_proc p, unnest(p.proargnames) a(attname) where p.proname = 'leaderboard'",
    );
    expect(cols.rows.map((c) => c.column_name)).not.toContain("city");
  });
});

describe("scopes", () => {
  beforeEach(async () => {
    await addPlayer({ n: 1, name: "MadridMe", country: "ES", hemisphere: "N", city: "Madrid", skills: 5 });
    await addPlayer({ n: 2, name: "MadridMate", country: "ES", hemisphere: "N", city: " madrid ", skills: 4 });
    await addPlayer({ n: 3, name: "BarcelonaPal", country: "ES", hemisphere: "N", city: "Barcelona", skills: 3 });
    await addPlayer({ n: 4, name: "ParisPal", country: "FR", hemisphere: "N", city: "Paris", skills: 2 });
    await addPlayer({ n: 5, name: "LimaPal", country: "PE", hemisphere: "S", city: "Lima", skills: 1 });
    await addPlayer({ n: 6, name: "Nowhere", skills: 0 });
  });
  const names = async (scope: string, as = 1) => (await board(as, scope)).map((r) => r.display_name);

  it("global lists everyone who joined", async () => {
    expect(await names("global")).toHaveLength(6);
  });
  it("continent keeps the caller's continent", async () => {
    expect(await names("continent")).toEqual(["MadridMe", "MadridMate", "BarcelonaPal", "ParisPal"]);
  });
  it("hemisphere keeps the caller's hemisphere", async () => {
    expect(await names("hemisphere", 5)).toEqual(["LimaPal"]);
    expect(await names("hemisphere")).toHaveLength(4);
  });
  it("country keeps the caller's country", async () => {
    expect(await names("country")).toEqual(["MadridMe", "MadridMate", "BarcelonaPal"]);
  });
  it("has no city board: a local scope is refused", async () => {
    await expect(board(1, "local")).rejects.toThrow(/Unknown scope/);
  });
  it("shows only the caller's own row when they haven't filled in what the scope needs", async () => {
    expect(await names("country", 6)).toEqual(["Nowhere"]);
  });
});

describe("ranking by the sprint alone", () => {
  it("sorts times with the fastest first, shares ranks on ties and leaves out players without a time", async () => {
    await addPlayer({ n: 1, name: "Slow", sprint: 8 });
    await addPlayer({ n: 2, name: "Fast", sprint: 5 });
    await addPlayer({ n: 3, name: "AlsoFast", sprint: 5 });
    await addPlayer({ n: 4, name: "NoTime", skills: 20 });
    const rows = await board(1, "global", "ft2");
    expect(rows.map((r) => [r.display_name, r.place, Number(r.best_sprint)])).toEqual([["AlsoFast", 1, 5], ["Fast", 1, 5], ["Slow", 3, 8]]);
  });
});

describe("cheating limits", () => {
  const sprint = async (n: number) =>
    Number((await db.query<{ best_sprint: string | null }>("select best_sprint from public.leaderboard_scores where user_id = $1", [id(n)])).rows[0].best_sprint);
  const save = (n: number, results: unknown, step = 1, level = "beginner") =>
    db.query("update public.progress set results = $2, player_step = $3, player_level = $4 where user_id = $1", [id(n), JSON.stringify(results), step, level]);
  const time = (v: number) => ({ skillId: "ft2", date: "2026-11-01", value: v });

  it("ignores sprint times under 3.6 s or over 15 s", async () => {
    await addPlayer({ n: 1, name: "Fake", results: [time(2.1), time(20), time(7.5)] });
    expect(await sprint(1)).toBe(7.5);
    await addPlayer({ n: 2, name: "OnlyFake", results: [time(2.1)] });
    const r = await db.query("select best_sprint from public.leaderboard_scores where user_id = $1", [id(2)]);
    expect(r.rows[0]).toEqual({ best_sprint: null });
  });

  it("lets the best sprint improve once per 24 hours, but allows it to get worse", async () => {
    await addPlayer({ n: 1, name: "Runner", results: [time(8)] });
    await save(1, [time(8), time(7)]);
    expect(await sprint(1)).toBe(8); // the first time counted as today's improvement
    await db.query("update public.leaderboard_scores set sprint_improved_at = now() - interval '25 hours'");
    await save(1, [time(8), time(7)]);
    expect(await sprint(1)).toBe(7);
    await save(1, [time(8), time(7), time(6)]);
    expect(await sprint(1)).toBe(7); // a second improvement inside a day is held back
    await save(1, [time(8)]);
    expect(await sprint(1)).toBe(8); // deleting the best result can't keep an old record
  });

  it("lets the level step rise by one per 24 hours", async () => {
    await addPlayer({ n: 1, name: "Climber", level: "beginner", step: 1 });
    const step = async () => Number((await db.query<{ level_step: number }>("select level_step from public.leaderboard_scores")).rows[0].level_step);
    // The first save started the 24-hour timer, so a rise is held back until it has passed.
    await save(1, [], 4, "advanced");
    expect(await step()).toBe(1);
    await db.query("update public.leaderboard_scores set level_step_raised_at = now() - interval '25 hours'");
    await save(1, [], 4, "advanced"); // asks for step 12 at once
    expect(await step()).toBe(2);
    await save(1, [], 4, "advanced");
    expect(await step()).toBe(2);
    await db.query("update public.leaderboard_scores set level_step_raised_at = now() - interval '25 hours'");
    await save(1, [], 4, "advanced");
    expect(await step()).toBe(3);
    await save(1, [], 1, "beginner"); // dropping back is always allowed
    expect(await step()).toBe(1);
  });
});

describe("names and reports", () => {
  it("refuses blocked words, bad characters, short names and duplicates ignoring case", async () => {
    await db.query("insert into auth.users (id) values ($1), ($2)", [id(1), id(2)]);
    const insert = (n: number, name: string) => db.query("insert into public.profiles (user_id, display_name) values ($1, $2)", [id(n), name]);
    await expect(insert(1, "FuckYou")).rejects.toThrow();
    await expect(insert(1, "Put4")).rejects.toThrow();
    await expect(insert(1, "ab")).rejects.toThrow();
    await expect(insert(1, "bad<name")).rejects.toThrow();
    await expect(insert(1, " Leo ")).rejects.toThrow();
    await insert(1, "Leo");
    await expect(insert(2, "LEO")).rejects.toThrow(/unique/i);
    await insert(2, "Calculo");
  });

  it("lets a player report another by name once, and not themselves", async () => {
    await addPlayer({ n: 1, name: "Reporter" });
    await addPlayer({ n: 2, name: "Target" });
    await db.query(`select set_config('test.uid', $1, false)`, [id(1)]);
    await db.query("select public.report_row('target', 'cheating')");
    await db.query("select public.report_row('Target', 'name')");
    await db.query("select public.report_row('Reporter', 'other')");
    await db.query("select public.report_row('Nobody', 'other')");
    const r = await db.query<{ reason: string }>("select reason from public.leaderboard_reports");
    expect(r.rows).toEqual([{ reason: "cheating" }]);
  });

  it("removes a player's profile and score when their account goes", async () => {
    await addPlayer({ n: 1, name: "Leaver", skills: 3 });
    await db.query("delete from auth.users where id = $1", [id(1)]);
    expect((await db.query("select 1 from public.profiles")).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.leaderboard_scores")).rows).toHaveLength(0);
  });
});

describe("who can read what", () => {
  it("lets a signed-in player read only their own profile and no scores", async () => {
    await addPlayer({ n: 1, name: "Me1" });
    await addPlayer({ n: 2, name: "Other" });
    await db.query(`select set_config('test.uid', $1, false)`, [id(1)]);
    await db.exec("set role authenticated");
    try {
      expect((await db.query("select display_name from public.profiles")).rows).toEqual([{ display_name: "Me1" }]);
      await expect(db.query("select * from public.leaderboard_scores")).rejects.toThrow(/permission denied/);
      await expect(db.query("insert into public.leaderboard_scores (user_id, tree_id, level_step, skills) values ($1, 'football', 16, 32)", [id(1)])).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.leaderboard_reports")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });

  it("gives signed-out callers no access at all", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from public.profiles")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.leaderboard('global','football')")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("display name blocklist", () => {
  const blocked = async (name: string) =>
    (await db.query<{ b: boolean }>("select public.display_name_blocked($1) as b", [name])).rows[0].b;

  it("blocks the Spanish words, their plurals and spaced-out spellings", async () => {
    for (const name of ["culo", "Marica", "maricon", "CHINGA", "putas", "Pijas", "culos", "maricones", "nazis", "big culo", "c.u.l.o", "m a r i c a"]) {
      expect(await blocked(name), name).toBe(true);
    }
  });

  it("keeps innocent names that merely contain a short word", async () => {
    for (const name of ["Chingachgook", "Maricarmen", "Cumulo", "Culottes", "Computadora", "Grape", "Raptor", "Putamen", "Puton"]) {
      expect(await blocked(name), name).toBe(false);
    }
  });
});
