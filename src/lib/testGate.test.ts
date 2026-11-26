import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { weights } from "../data/weights";
import type { Skill } from "../types";
import { needsTest, TEST_REQUIRED_FROM_ROW } from "./testGate";

const gated = (tree: { skills: Skill[] }) => tree.skills.filter(needsTest).map((s) => s.id);

describe("needsTest", () => {
  it("gates the advanced skills of each branch in football", () => {
    expect(gated(football)).toEqual(["bc4", "bc5", "ps4", "ps5", "dr4", "dr5", "sh4", "sh5", "df3", "df5", "ft4", "ft5"]);
  });

  it("gates the fourth and fifth skill of each branch in weights", () => {
    expect(gated(weights)).toEqual(["lg4", "lg5", "pw4", "pw5", "cr4", "cr5", "ip4", "ip5"]);
  });

  it("never gates the start and final skills, or a skill with no counter or timer", () => {
    for (const tree of [football, weights]) {
      for (const s of tree.skills.filter((x) => x.branch === null)) expect(needsTest(s), `${tree.id} ${s.id}`).toBe(false);
    }
    const base = football.skills.find((s) => s.id === "bc4")!;
    expect(needsTest(base)).toBe(true);
    expect(needsTest({ ...base, check: { kind: "done" } })).toBe(false);
    expect(needsTest({ ...base, check: undefined })).toBe(false);
  });

  it("only gates from the gating tier down", () => {
    const base = football.skills.find((s) => s.id === "bc1")!;
    expect(needsTest({ ...base, row: TEST_REQUIRED_FROM_ROW - 1 })).toBe(false);
    expect(needsTest({ ...base, row: TEST_REQUIRED_FROM_ROW })).toBe(true);
  });

  it("only gates skills that test mode can run, so nobody is left without a way to pass", () => {
    for (const tree of [football, weights]) {
      for (const s of tree.skills.filter(needsTest)) expect(s.check?.kind, `${tree.id} ${s.id}`).not.toBe("done");
    }
  });
});
