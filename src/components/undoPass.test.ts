import { describe, expect, it } from "vitest";
import { football } from "../data/football";
import { en } from "../i18n/en";
import { undoPass } from "./undoPass";

const first = football.skills.find((s) => s.requires.includes("root") && s.branch)!;
const dependent = football.skills.find((s) => s.requires.includes(first.id))!;

describe("undoPass", () => {
  it("un-passes a skill nothing else needs yet", () => {
    const done = new Set(["root", first.id]);
    const result = undoPass(football, done, first.id);
    expect(result.blockers).toEqual([]);
    expect([...result.done]).toEqual(["root"]);
    expect(done.has(first.id)).toBe(true);
  });

  it("changes nothing when a skill that needs it was passed in the meantime", () => {
    const done = new Set(["root", first.id, dependent.id]);
    const result = undoPass(football, done, first.id);
    expect(result.done).toBe(done);
    expect([...result.done].sort()).toEqual(["root", first.id, dependent.id].sort());
    expect(result.blockers.map((s) => s.id)).toEqual([dependent.id]);
    expect(en.panel.undoFirst(result.blockers.map((s) => s.name))).toBe(`To undo this, first undo: ${dependent.name}.`);
  });
});
