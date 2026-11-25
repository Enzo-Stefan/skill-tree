import type { Skill, Tree } from "../types";
import { skillState } from "../lib/progress";
import { inUnlockOrder } from "./nextUp";

// Helpers for the tree that grows upward: the first skill at the bottom, the final one on top.

/** One line of the tree: `from` must be done before `to` opens. It grows from `from` up to `to`. */
export interface Edge {
  from: string;
  to: string;
}

/** Every "needs" link in the tree, as lines from the skill that unlocks to the skill it unlocks. */
export function treeEdges(tree: Tree): Edge[] {
  return tree.skills.flatMap((s) => s.requires.map((from) => ({ from, to: s.id })));
}

/**
 * The skill to scroll to when the player picks a branch: where they are in it. That is the first
 * skill they haven't passed, or the top skill of the branch once all of it is done.
 *
 * Returns:
 *   The skill, or null if the branch has none.
 */
export function branchFocusSkill(tree: Tree, branchId: string, done: Set<string>): Skill | null {
  const skills = inUnlockOrder(tree.skills.filter((s) => s.branch === branchId));
  return skills.find((s) => skillState(s, done) !== "done") ?? skills[skills.length - 1] ?? null;
}

/** Where a point is, relative to the tree it is drawn in. */
export interface Point {
  x: number;
  y: number;
}

/**
 * The curve of one line, as an SVG path. It starts at the top of the lower skill's circle (`from`)
 * and ends at the bottom of the upper skill's circle (`to`), so a stroke animated from the start
 * grows upward. Skills in the same column get a straight line, others an S-shaped curve.
 */
export function connectorPath(from: Point, to: Point): string {
  const round = (n: number) => Math.round(n * 10) / 10;
  if (Math.abs(from.x - to.x) < 1) return `M ${round(from.x)} ${round(from.y)} L ${round(to.x)} ${round(to.y)}`;
  const lift = Math.abs(from.y - to.y) / 2;
  return `M ${round(from.x)} ${round(from.y)} C ${round(from.x)} ${round(from.y - lift)}, ${round(to.x)} ${round(to.y + lift)}, ${round(to.x)} ${round(to.y)}`;
}

/** Where a skill sits on the wide tree's grid. Rows count from the top, columns are half a slot wide. */
export interface GridSpot {
  /** First column and how many it covers (1-based, like CSS grid). */
  column: number;
  span: number;
  /** Row from the top (1-based). Row 1 is the final skill, row 2 the branch names. */
  row: number;
}

/** The wide tree's grid: where each skill goes, how many columns it has, and which columns each branch covers. */
export interface TreeGrid {
  spots: Map<string, GridSpot>;
  columns: number;
  rows: number;
  /** Column range of each branch's band, by branch id. */
  bands: Map<string, { column: number; span: number }>;
}

/**
 * Places the skills on a grid from their `x` (horizontal slot) and `row` (tier) in the tree data,
 * flipped so tier 0 is at the bottom. A slot is two columns wide, so x 0.5 sits between two slots.
 * The start and final skills get four columns so their names fit, centred on the same spot.
 */
export function treeGrid(tree: Tree): TreeGrid {
  const isFinal = (s: Skill) => s.branch === null && s.requires.length > 0;
  const inBranches = tree.skills.filter((s) => !isFinal(s));
  const topTier = Math.max(0, ...inBranches.map((s) => s.row));
  const spots = new Map<string, GridSpot>();
  for (const s of tree.skills) {
    const wide = s.branch === null;
    spots.set(s.id, {
      column: Math.round(s.x * 2) + 1 - (wide ? 1 : 0),
      span: wide ? 4 : 2,
      row: isFinal(s) ? 1 : 3 + (topTier - s.row),
    });
  }
  const bands = new Map<string, { column: number; span: number }>();
  for (const b of tree.branches) {
    const own = tree.skills.filter((s) => s.branch === b.id).map((s) => spots.get(s.id)!);
    if (own.length === 0) continue;
    const first = Math.min(...own.map((o) => o.column));
    const last = Math.max(...own.map((o) => o.column + o.span - 1));
    bands.set(b.id, { column: first, span: last - first + 1 });
  }
  const spotList = [...spots.values()];
  return {
    spots,
    columns: Math.max(1, ...spotList.map((o) => o.column + o.span - 1)),
    rows: Math.max(3, ...spotList.map((o) => o.row)),
    bands,
  };
}

/** The skill the screen scrolls to after a pass: the first of the skills it just opened, in unlock order. */
export function revealTarget(unlocked: Skill[]): Skill | null {
  return inUnlockOrder(unlocked)[0] ?? null;
}

/** The id of the tree area, which both rows of pills (trees and branches) control. */
export const TREE_PANEL_ID = "tree-panel";
