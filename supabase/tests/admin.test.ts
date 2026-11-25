import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

// Runs migrations 001, 003, 005 and 006 in an in-memory Postgres and checks the admin side of the
// leaderboard reports (#104): who is an admin, what they can read, and that a hidden row stays hidden.

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
const ADMIN = 1;
const REPORTER = 2;
const TARGET = 3;
const OTHER = 4;
let db: PGlite;

async function as(n: number | null) {
  await db.query(`select set_config('test.uid', $1, false)`, [n === null ? "" : id(n)]);
}

async function addPlayer(n: number, name: string) {
  await db.query("insert into auth.users (id) values ($1)", [id(n)]);
  await db.query("insert into public.profiles (user_id, display_name, leaderboard_opt_in) values ($1, $2, true)", [id(n), name]);
  await db.query(
    "insert into public.progress (user_id, tree_id, done, player_level, player_step, results) values ($1, 'football', '{}', 'beginner', 1, '[]')",
    [id(n)],
  );
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  for (const f of ["001_progress.sql", "003_lift_log_and_results.sql", "005_leaderboard.sql", "006_admin_reports.sql"]) await db.exec(sql(f));
  await addPlayer(ADMIN, "Admin");
  await addPlayer(REPORTER, "Reporter");
  await addPlayer(TARGET, "Target");
  await addPlayer(OTHER, "Bystander");
  await db.query("insert into public.admins (user_id) values ($1)", [id(ADMIN)]);
});

/** The row key of a listed player, as the app sees it. */
async function keyOf(viewer: number, name: string): Promise<string> {
  await as(viewer);
  const rows = await db.query<{ row_key: string; display_name: string }>("select * from public.leaderboard('global', 'football')");
  return rows.rows.find((r) => r.display_name === name)!.row_key;
}

async function report(from: number, name: string, reason = "bad name") {
  const key = await keyOf(from, name);
  await as(from);
  await db.query("select public.report_row($1, $2)", [key, reason]);
}

async function names(viewer: number): Promise<string[]> {
  await as(viewer);
  return (await db.query<{ display_name: string }>("select display_name from public.leaderboard('global', 'football')")).rows.map((r) => r.display_name);
}

interface Group {
  row_key: string;
  display_name: string;
  hidden: boolean;
  open_count: number;
  reports: { id: number; reason: string; reporter: string; status: string }[];
}

async function list(which = "open"): Promise<Group[]> {
  await as(ADMIN);
  return (await db.query<Group>("select * from public.admin_list_reports($1)", [which])).rows;
}

describe("the migration", () => {
  it("can be run twice", async () => {
    await db.exec(sql("006_admin_reports.sql"));
    await report(REPORTER, "Target");
    expect(await list()).toHaveLength(1);
  });
});

describe("who is an admin", () => {
  it("is true only for a user in the admins table", async () => {
    await as(ADMIN);
    expect((await db.query<{ is_admin: boolean }>("select public.is_admin()")).rows[0]!.is_admin).toBe(true);
    await as(REPORTER);
    expect((await db.query<{ is_admin: boolean }>("select public.is_admin()")).rows[0]!.is_admin).toBe(false);
    await as(null);
    expect((await db.query<{ is_admin: boolean }>("select public.is_admin()")).rows[0]!.is_admin).toBe(false);
  });

  it("refuses every admin function for a player and for a signed-out caller", async () => {
    await report(REPORTER, "Target");
    const key = await keyOf(REPORTER, "Target");
    for (const who of [REPORTER, null]) {
      await as(who);
      await expect(db.query("select * from public.admin_list_reports('open')")).rejects.toThrow(/Not found/);
      await expect(db.query("select public.admin_resolve_report(1, 'dismiss')")).rejects.toThrow(/Not found/);
      await expect(db.query("select public.admin_unhide($1)", [key])).rejects.toThrow(/Not found/);
    }
  });

  it("gives players and signed-out callers no way to read or write the admin tables", async () => {
    await as(REPORTER);
    await db.exec("set role authenticated");
    try {
      await expect(db.query("select * from public.admins")).rejects.toThrow(/permission denied/);
      await expect(db.query("insert into public.admins (user_id) values ($1)", [id(REPORTER)])).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.leaderboard_hidden")).rejects.toThrow(/permission denied/);
      await expect(db.query("insert into public.leaderboard_hidden (user_id) values ($1)", [id(TARGET)])).rejects.toThrow(/permission denied/);
      await expect(db.query("update public.leaderboard_reports set status = 'dismissed'")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
    await db.exec("set role anon");
    try {
      await expect(db.query("select public.is_admin()")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.admin_list_reports('open')")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("reading reports", () => {
  it("groups open reports by reported player with the reporter's name, and never returns a user id", async () => {
    await report(REPORTER, "Target", "name is rude");
    await report(OTHER, "Target", "score looks fake");
    await report(REPORTER, "Bystander", "other");
    const groups = await list();
    expect(groups.map((g) => [g.display_name, g.open_count])).toEqual([["Bystander", 1], ["Target", 2]]);
    const target = groups.find((g) => g.display_name === "Target")!;
    expect(target.reports.map((r) => [r.reporter, r.reason])).toEqual([["Bystander", "score looks fake"], ["Reporter", "name is rude"]]);
    expect(JSON.stringify(groups)).not.toContain(id(TARGET));
    expect(JSON.stringify(groups)).not.toContain(id(REPORTER));
  });

  it("refuses an unknown list name", async () => {
    await as(ADMIN);
    await expect(db.query("select * from public.admin_list_reports('all')")).rejects.toThrow(/Unknown list/);
  });
});

describe("resolving reports", () => {
  it("dismiss closes one report and leaves the row on the board", async () => {
    await report(REPORTER, "Target");
    await report(OTHER, "Target", "second");
    const first = (await list())[0]!.reports.at(-1)!;
    await as(ADMIN);
    await db.query("select public.admin_resolve_report($1, 'dismiss')", [first.id]);
    const open = await list();
    expect(open[0]!.open_count).toBe(1);
    const resolved = await list("resolved");
    expect(resolved[0]!.reports.map((r) => r.status)).toEqual(["dismissed"]);
    expect(await names(OTHER)).toContain("Target");
  });

  it("hide takes the row off the board and closes all the player's open reports", async () => {
    await report(REPORTER, "Target");
    await report(OTHER, "Target");
    const any = (await list())[0]!.reports[0]!;
    await as(ADMIN);
    await db.query("select public.admin_resolve_report($1, 'hide')", [any.id]);
    expect(await list()).toEqual([]);
    const resolved = await list("resolved");
    expect(resolved[0]!.hidden).toBe(true);
    expect(resolved[0]!.reports.map((r) => r.status)).toEqual(["actioned", "actioned"]);
    expect(await names(OTHER)).not.toContain("Target");
    expect(await names(TARGET)).not.toContain("Target");
    expect((await db.query<{ hidden_by: string }>("select hidden_by from public.leaderboard_hidden")).rows).toEqual([{ hidden_by: id(ADMIN) }]);
  });

  it("refuses unknown actions and unknown report ids", async () => {
    await as(ADMIN);
    await expect(db.query("select public.admin_resolve_report(1, 'ban')")).rejects.toThrow(/Unknown action/);
    await expect(db.query("select public.admin_resolve_report(999, 'dismiss')")).rejects.toThrow(/No such report/);
  });

  it("unhide brings the row back, using the row key even after every report is resolved", async () => {
    await report(REPORTER, "Target");
    const g = (await list())[0]!;
    await as(ADMIN);
    await db.query("select public.admin_resolve_report($1, 'hide')", [g.reports[0]!.id]);
    expect(await names(OTHER)).not.toContain("Target");
    const hidden = (await list("resolved"))[0]!;
    await as(ADMIN);
    await db.query("select public.admin_unhide($1)", [hidden.row_key]);
    expect(await names(OTHER)).toContain("Target");
    expect((await list("resolved"))[0]!.hidden).toBe(false);
  });
});

describe("a hidden row stays hidden", () => {
  async function hideTarget() {
    await report(REPORTER, "Target");
    const g = (await list())[0]!;
    await as(ADMIN);
    await db.query("select public.admin_resolve_report($1, 'hide')", [g.reports[0]!.id]);
  }

  it("when the player turns the opt-in off and on again", async () => {
    await hideTarget();
    await db.query("update public.profiles set leaderboard_opt_in = false where user_id = $1", [id(TARGET)]);
    await db.query("update public.profiles set leaderboard_opt_in = true where user_id = $1", [id(TARGET)]);
    expect(await names(OTHER)).not.toContain("Target");
  });

  it("when the player deletes their profile and joins again under a new name", async () => {
    await hideTarget();
    await db.query("delete from public.profiles where user_id = $1", [id(TARGET)]);
    await db.query("insert into public.profiles (user_id, display_name, leaderboard_opt_in) values ($1, 'Fresh', true)", [id(TARGET)]);
    expect(await names(OTHER)).not.toContain("Fresh");
    expect(await names(OTHER)).not.toContain("Target");
  });

  it("and is forgotten only when the whole account is deleted", async () => {
    await hideTarget();
    await db.query("delete from auth.users where id = $1", [id(TARGET)]);
    expect((await db.query("select 1 from public.leaderboard_hidden")).rows).toHaveLength(0);
  });
});

describe("reporting again", () => {
  it("still ignores a second open report from the same player on the same row", async () => {
    await report(REPORTER, "Target", "first");
    await report(REPORTER, "Target", "second");
    expect((await db.query("select 1 from public.leaderboard_reports")).rows).toHaveLength(1);
  });

  it("accepts a new report once the old one is dismissed", async () => {
    await report(REPORTER, "Target", "first");
    const g = (await list())[0]!;
    await as(ADMIN);
    await db.query("select public.admin_resolve_report($1, 'dismiss')", [g.reports[0]!.id]);
    await report(REPORTER, "Target", "changed their name");
    const rows = await db.query<{ status: string; reason: string }>("select status, reason from public.leaderboard_reports order by id");
    expect(rows.rows).toEqual([{ status: "dismissed", reason: "first" }, { status: "open", reason: "changed their name" }]);
  });
});
