import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { XP_AMOUNTS } from "../data/xp";
import { passedOn, prerequisites, skillRewards } from "./skillFacts";

const skill = (id: string) => football.skills.find((s) => s.id === id)!;

describe("skill page data", () => {
  it("gives the XP for a pass and the skills the skill opens", () => {
    const r = skillRewards(football, skill("bc1"));
    expect(r.xp).toBe(XP_AMOUNTS.skill);
    expect(r.opens.map((s) => s.id).sort()).toEqual(football.skills.filter((s) => s.requires.includes("bc1")).map((s) => s.id).sort());
    expect(r.opens.length).toBeGreaterThan(0);
  });
  it("opens nothing for the final skill", () => {
    expect(skillRewards(football, skill("final")).opens).toEqual([]);
  });
  it("lists the prerequisites as skills", () => {
    expect(prerequisites(football, skill("bc1")).map((s) => s.id)).toEqual(["root"]);
    expect(prerequisites(football, skill("root"))).toEqual([]);
  });
  it("reads the pass day from the XP ledger, only while the pass is active", () => {
    const at = new Date(2026, 10, 3, 15).toISOString();
    expect(passedOn([{ key: "skill:bc1:pass", xp: 100, active: true, at }], "bc1")).toBe("2026-11-03");
    expect(passedOn([{ key: "skill:bc1:pass", xp: 100, active: false, at }], "bc1")).toBeNull();
    expect(passedOn([], "bc1")).toBeNull();
  });
});
