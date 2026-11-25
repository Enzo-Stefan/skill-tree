import { describe, expect, it } from "vitest";
import { trees } from "../data";
import { football } from "../data/football";
import { branchFocusSkill, connectorPath, revealTarget, treeEdges, treeGrid } from "./treeView";

describe("tree lines", () => {
  it("has one line for every link between skills, from the skill that unlocks to the one it unlocks", () => {
    const edges = treeEdges(football);
    const links = football.skills.reduce((n, s) => n + s.requires.length, 0);
    expect(edges).toHaveLength(links);
    expect(edges).toContainEqual({ from: "root", to: "bc1" });
    expect(edges).toContainEqual({ from: "bc4", to: "bc5" });
    expect(edges).toContainEqual({ from: "bc3", to: "bc5" });
  });

  it.each(trees)("only joins skills that exist in $id", (tree) => {
    const ids = new Set(tree.skills.map((s) => s.id));
    for (const e of treeEdges(tree)) {
      expect(ids.has(e.from), e.from).toBe(true);
      expect(ids.has(e.to), e.to).toBe(true);
    }
  });

  it("draws a straight line between two skills in one column", () => {
    expect(connectorPath({ x: 50, y: 200 }, { x: 50, y: 150 })).toBe("M 50 200 L 50 150");
  });

  it("starts at the lower skill and ends at the upper one, so a growing stroke moves up", () => {
    const d = connectorPath({ x: 50, y: 200 }, { x: 150, y: 100 });
    expect(d.startsWith("M 50 200")).toBe(true);
    expect(d.endsWith("150 100")).toBe(true);
  });

});

describe("the wide tree's grid", () => {
  const grid = treeGrid(football);
  const spot = (id: string) => grid.spots.get(id)!;

  it("puts the first skill at the bottom and the final skill on top", () => {
    expect(spot("final").row).toBe(1);
    expect(spot("root").row).toBe(grid.rows);
    expect(spot("bc1").row).toBeLessThan(spot("root").row);
  });

  it("puts every skill above the skills it needs", () => {
    for (const e of treeEdges(football)) expect(spot(e.to).row, `${e.from} to ${e.to}`).toBeLessThan(spot(e.from).row);
  });

  it("keeps the branch names on their own row between the final skill and the branches", () => {
    for (const s of football.skills) {
      if (s.id !== "final") expect(spot(s.id).row, s.id).toBeGreaterThan(2);
    }
  });

  it("gives each branch its own columns, side by side in order", () => {
    const bands = football.branches.map((b) => grid.bands.get(b.id)!);
    for (let i = 1; i < bands.length; i++) expect(bands[i].column).toBeGreaterThanOrEqual(bands[i - 1].column + bands[i - 1].span);
  });

  it("never lets two skills share a cell", () => {
    for (const tree of trees) {
      const g = treeGrid(tree);
      const taken = new Set<string>();
      for (const [id, o] of g.spots) {
        for (let c = o.column; c < o.column + o.span; c++) {
          const key = `${o.row}:${c}`;
          expect(taken.has(key), `${tree.id} ${id}`).toBe(false);
          taken.add(key);
        }
      }
    }
  });

  it("fits every skill inside the columns", () => {
    for (const tree of trees) {
      const g = treeGrid(tree);
      for (const o of g.spots.values()) expect(o.column + o.span - 1).toBeLessThanOrEqual(g.columns);
    }
  });

});

describe("jumping to a branch", () => {
  it("lands on the first skill the player hasn't passed", () => {
    expect(branchFocusSkill(football, "bc", new Set())?.id).toBe("bc1");
    expect(branchFocusSkill(football, "bc", new Set(["root", "bc1"]))?.id).toBe("bc2");
    expect(branchFocusSkill(football, "bc", new Set(["root", "bc1", "bc2", "bc3", "bc4"]))?.id).toBe("bc5");
  });

  it("lands on the top of a finished branch", () => {
    const all = new Set(football.skills.filter((s) => s.branch === "ps").map((s) => s.id));
    expect(branchFocusSkill(football, "ps", all)?.id).toBe("ps5");
  });

  it("finds nothing for a branch that doesn't exist", () => {
    expect(branchFocusSkill(football, "nope", new Set())).toBeNull();
  });
});

describe("scrolling up to a new skill", () => {
  it("picks the first skill that opened", () => {
    const opened = football.skills.filter((s) => s.id === "bc3" || s.id === "bc2");
    expect(revealTarget(opened)?.id).toBe("bc2");
  });

  it("picks nothing when nothing opened", () => {
    expect(revealTarget([])).toBeNull();
  });
});
