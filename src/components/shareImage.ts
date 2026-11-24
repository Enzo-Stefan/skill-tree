import type { Tree } from "../types";
import { levelInfo } from "../lib/progress";
import { t } from "../i18n";

export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1350;

const GRASS = "#0e2c20";
const GRASS_2 = "#113425";
const CHALK = "#eef3ea";
const CHALK_DIM = "rgba(238, 243, 234, 0.55)";
const CHALK_FAINT = "rgba(238, 243, 234, 0.16)";
const GOLD = "#f2c14e";
const DISPLAY = '"Oswald", "Arial Narrow", Impact, sans-serif';
const BODY = '"Source Sans 3", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export interface ShareStats {
  title: string;
  rank: string;
  levelName: string | null;
  streak: number | null;
  done: number;
  total: number;
  branches: { name: string; color: string; done: number; total: number }[];
  nodes: { id: string; x: number; row: number; big: boolean; color: string; done: boolean; requires: string[] }[];
  site: string;
}

/** Everything the share image shows, worked out from the player's progress. */
export function shareStats(
  tree: Tree,
  done: Set<string>,
  levelName: string | null,
  streak: number | null,
  site: string,
): ShareStats {
  const colorOf = (branch: string | null) => tree.branches.find((b) => b.id === branch)?.color ?? GOLD;
  return {
    title: tree.title,
    rank: levelInfo(tree.levels, done.size).current.name,
    levelName,
    streak: levelName ? streak : null,
    done: tree.skills.filter((s) => done.has(s.id)).length,
    total: tree.skills.length,
    branches: tree.branches.map((b) => {
      const skills = tree.skills.filter((s) => s.branch === b.id);
      return { name: b.name, color: b.color, done: skills.filter((s) => done.has(s.id)).length, total: skills.length };
    }),
    nodes: tree.skills.map((s) => ({
      id: s.id,
      x: s.x,
      row: s.row,
      big: Boolean(s.big),
      color: colorOf(s.branch),
      done: done.has(s.id),
      requires: s.requires,
    })),
    site,
  };
}

function drawMiniTree(ctx: CanvasRenderingContext2D, stats: ShareStats, top: number, height: number): void {
  const left = 110;
  const width = SHARE_WIDTH - left * 2;
  const slots = Math.max(...stats.nodes.map((n) => n.x)) + 1;
  const rows = Math.max(...stats.nodes.map((n) => n.row));
  const pos = (n: ShareStats["nodes"][number]) => ({
    x: left + (n.x + 0.5) * (width / slots),
    y: top + (rows === 0 ? 0 : (n.row / rows) * height),
  });
  const byId = new Map(stats.nodes.map((n) => [n.id, n]));

  for (const child of stats.nodes) {
    for (const parentId of child.requires) {
      const parent = byId.get(parentId);
      if (!parent) continue;
      const a = pos(parent);
      const b = pos(child);
      const lit = parent.done && child.done;
      ctx.strokeStyle = lit ? child.color : CHALK_FAINT;
      ctx.lineWidth = lit ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const mid = (a.y + b.y) / 2;
      ctx.bezierCurveTo(a.x, mid, b.x, mid, b.x, b.y);
      ctx.stroke();
    }
  }

  for (const n of stats.nodes) {
    const p = pos(n);
    const r = n.big ? 30 : 17;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    if (n.done) {
      ctx.fillStyle = n.color;
      ctx.fill();
    } else {
      ctx.fillStyle = GRASS;
      ctx.fill();
      ctx.strokeStyle = CHALK_FAINT;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

/** Draws the share image onto a SHARE_WIDTH x SHARE_HEIGHT canvas. */
export function drawShareImage(ctx: CanvasRenderingContext2D, stats: ShareStats): void {
  for (let x = 0; x < SHARE_WIDTH; x += 108) {
    ctx.fillStyle = (x / 108) % 2 === 0 ? GRASS : GRASS_2;
    ctx.fillRect(x, 0, 108, SHARE_HEIGHT);
  }
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = CHALK_DIM;
  ctx.font = `600 34px ${DISPLAY}`;
  ctx.fillText(stats.title, 90, 120);

  ctx.fillStyle = GOLD;
  ctx.font = `700 112px ${DISPLAY}`;
  ctx.fillText(stats.rank.toUpperCase(), 86, 240);

  ctx.fillStyle = CHALK;
  ctx.font = `600 44px ${BODY}`;
  ctx.fillText(t.share.imageSkills(stats.done, stats.total), 90, 310);

  if (stats.levelName) {
    const streak = stats.streak ? t.share.imageStreak(stats.streak) : "";
    ctx.fillStyle = CHALK_DIM;
    ctx.font = `400 36px ${BODY}`;
    ctx.fillText(t.share.imageTraining(stats.levelName, streak), 90, 362);
  }

  drawMiniTree(ctx, stats, 450, 330);

  let y = 880;
  for (const b of stats.branches) {
    ctx.fillStyle = CHALK;
    ctx.font = `600 30px ${DISPLAY}`;
    ctx.textAlign = "left";
    ctx.fillText(b.name.toUpperCase(), 90, y);
    ctx.textAlign = "right";
    ctx.fillStyle = CHALK_DIM;
    ctx.font = `700 28px ${BODY}`;
    ctx.fillText(`${b.done}/${b.total}`, SHARE_WIDTH - 90, y);
    const barY = y + 14;
    const barW = SHARE_WIDTH - 180;
    ctx.fillStyle = CHALK_FAINT;
    ctx.fillRect(90, barY, barW, 12);
    ctx.fillStyle = b.color;
    ctx.fillRect(90, barY, b.total ? (barW * b.done) / b.total : 0, 12);
    y += 66;
  }

  ctx.textAlign = "center";
  ctx.fillStyle = CHALK_DIM;
  ctx.font = `400 30px ${BODY}`;
  ctx.fillText(stats.site, SHARE_WIDTH / 2, SHARE_HEIGHT - 50);
}

/** Renders the share image to a PNG. Waits for the app's fonts so the text matches the app. */
export async function renderShareImage(stats: ShareStats): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load(`700 112px ${DISPLAY}`), document.fonts.load(`600 44px ${BODY}`)]);
  } catch {
    // Fonts are a nicety. The fallbacks in the font stacks still draw fine.
  }
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(t.share.cantDraw);
  drawShareImage(ctx, stats);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(t.share.imageFailed))), "image/png"),
  );
}
