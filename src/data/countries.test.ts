import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countries, countryByCode } from "./countries";
import { continentOf, hemisphereFor } from "../lib/leaderboard";

const sql = readFileSync(new URL("../../supabase/migrations/005_leaderboard.sql", import.meta.url), "utf8");

/** The codes in `when code = any (array[...]) then 'X'` for one result, from the SQL function with that name. */
function sqlCodes(fn: string, result: string): string[] {
  const body = sql.slice(sql.indexOf(`function public.${fn}`));
  const line = body.split("\n").find((l) => l.includes("array[") && l.includes(`then ${result}`) || l.includes("array[") && l.includes(`then picked`) && result === "picked");
  if (!line) throw new Error(`no ${result} line in ${fn}`);
  return [...line.split("then")[0].matchAll(/'([A-Z]{2})'/g)].map((m) => m[1]);
}

describe("country table", () => {
  it("has unique ISO codes of two capital letters", () => {
    const codes = countries.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(c).toMatch(/^[A-Z]{2}$/);
  });

  it("covers the world: every continent has countries, and there are around 195 in all", () => {
    expect(countries.length).toBeGreaterThanOrEqual(190);
    for (const continent of ["AF", "AS", "EU", "NA", "SA", "OC"] as const) {
      expect(countries.filter((c) => c.continent === continent).length, continent).toBeGreaterThan(5);
    }
  });

  it("looks countries up by code, in any case", () => {
    expect(countryByCode("al")?.name).toBe("Albania");
    expect(countryByCode("XX")).toBeUndefined();
    expect(countryByCode(null)).toBeUndefined();
  });

  it("files well-known countries under the right continent", () => {
    const expected: Record<string, string> = { AL: "EU", RU: "EU", TR: "AS", EG: "AF", BR: "SA", MX: "NA", AU: "OC", ZA: "AF", JP: "AS", US: "NA" };
    for (const [code, continent] of Object.entries(expected)) expect(continentOf(code), code).toBe(continent);
  });

  it("marks the countries that cross the equator", () => {
    const crossing = countries.filter((c) => c.crossesEquator).map((c) => c.code).sort();
    expect(crossing).toEqual(["BR", "CD", "CG", "CO", "EC", "GA", "GQ", "ID", "KE", "KI", "MV", "SO", "ST", "UG"]);
  });

  it("has Nauru wholly in the south", () => {
    expect(countryByCode("NR")?.continent).toBe("OC");
    expect(countryByCode("NR")?.crossesEquator).toBeFalsy();
    expect(countryByCode("NR")!.capitalLat).toBeLessThan(0);
    expect(hemisphereFor("NR", "N")).toBe("S");
  });

  it("has the territories and dependencies players pick", () => {
    const territories = [
      "PR", "HK", "MO", "GU", "VI", "AS", "MP", "GL", "FO", "GI", "IM", "JE", "GG", "AW", "CW", "SX", "BM", "KY", "TC", "VG", "AI", "MS", "GP",
      "MQ", "RE", "YT", "GF", "PF", "NC", "WF", "PM", "BL", "MF", "FK", "CK", "NU", "TK", "NF", "CX", "CC", "PN", "SH", "BQ", "EH", "AX", "SJ",
    ];
    for (const code of territories) expect(countryByCode(code), code).toBeDefined();
    const expected: Record<string, [string, "N" | "S"]> = {
      PR: ["NA", "N"], HK: ["AS", "N"], GL: ["NA", "N"], FO: ["EU", "N"], RE: ["AF", "S"], FK: ["SA", "S"], GF: ["SA", "N"], NC: ["OC", "S"], GU: ["OC", "N"],
    };
    for (const [code, [continent, hemi]] of Object.entries(expected)) {
      expect(continentOf(code), code).toBe(continent);
      expect(hemisphereFor(code, null), code).toBe(hemi);
    }
  });
});

describe("the database lists match the table", () => {
  it("country_continent has every country under the same continent", () => {
    for (const continent of ["AF", "AS", "EU", "NA", "SA", "OC"] as const) {
      const body = sql.slice(sql.indexOf("function public.country_continent"), sql.indexOf("function public.country_hemisphere"));
      const line = body.split("\n").find((l) => l.includes(`then '${continent}'`))!;
      const inSql = [...line.split("then")[0].matchAll(/'([A-Z]{2})'/g)].map((m) => m[1]).sort();
      const inTs = countries.filter((c) => c.continent === continent).map((c) => c.code).sort();
      expect(inSql, continent).toEqual(inTs);
    }
  });

  it("country_hemisphere has the same equator-crossing and southern countries", () => {
    expect(sqlCodes("country_hemisphere", "picked").sort()).toEqual(countries.filter((c) => c.crossesEquator).map((c) => c.code).sort());
    const south = countries.filter((c) => !c.crossesEquator && c.capitalLat < 0).map((c) => c.code).sort();
    expect(sqlCodes("country_hemisphere", "'S'").sort()).toEqual(south);
  });

  it("country_hemisphere is null for a code not in the list, as hemisphereFor is", () => {
    const body = sql.slice(sql.indexOf("function public.country_hemisphere"));
    expect(body).toMatch(/when public\.country_continent\(code\) is null then null/);
    // Checked before the equator and south lists, so an unknown code never falls through to 'N'.
    expect(body.indexOf("country_continent(code) is null")).toBeLessThan(body.indexOf("then picked"));
  });

  it("profiles only accept codes from the list", () => {
    expect(sql).toMatch(/add constraint profiles_country_code_known\s+check \(country_code is null or public\.country_continent\(country_code\) is not null\) not valid;/);
    // After section 6, so the function it calls already exists.
    expect(sql.indexOf("add constraint profiles_country_code_known")).toBeGreaterThan(sql.indexOf("function public.country_continent"));
  });
});

describe("hemisphere rule", () => {
  it("is worked out from the capital for ordinary countries, ignoring any pick", () => {
    expect(hemisphereFor("AL", null)).toBe("N");
    expect(hemisphereFor("AL", "S")).toBe("N");
    expect(hemisphereFor("AR", null)).toBe("S");
    expect(hemisphereFor("ZA", "N")).toBe("S");
    expect(hemisphereFor("AU", null)).toBe("S");
  });

  it("uses the player's pick for countries that cross the equator, or null before they pick", () => {
    for (const code of ["BR", "ID", "EC", "KE", "CO"]) {
      expect(hemisphereFor(code, null), code).toBeNull();
      expect(hemisphereFor(code, "S"), code).toBe("S");
      expect(hemisphereFor(code, "N"), code).toBe("N");
    }
  });

  it("is null for an unknown or missing country", () => {
    expect(hemisphereFor(null, "N")).toBeNull();
    expect(hemisphereFor("XX", "N")).toBeNull();
  });
});
