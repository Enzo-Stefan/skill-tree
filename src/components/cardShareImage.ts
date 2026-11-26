import type { Tree } from "../types";
import type { Ratings } from "../lib/ratings";
import type { PlayerCard } from "../lib/ratingHistory";
import { BG, BODY, FG, FG_2, FG_FAINT, GLOW, SHARE_HEIGHT, SHARE_WIDTH, mutedBranchColor } from "./shareImage";
import { t } from "../i18n";

/** The player card share image (#123): same size and look as the progress image, with ratings instead of the tree. */
export interface CardShareStats {
  title: string;
  levelName: string | null;
  /** "MID · Left foot", or an empty string when neither is chosen. */
  details: string;
  overall: number;
  branches: { name: string; color: string; value: number }[];
  site: string;
}

export function cardShareStats(tree: Tree, ratings: Ratings, card: PlayerCard, levelName: string | null, site: string): CardShareStats {
  const parts = [card.position ? t.playerCard.positions[card.position] : null, card.foot ? t.playerCard.footValue(t.playerCard.feet[card.foot]) : null].filter((p): p is string => p !== null);
  return {
    title: tree.title,
    levelName,
    details: parts.join(" · "),
    overall: ratings.overall,
    branches: tree.branches.map((b) => ({ name: b.name, color: b.color, value: ratings.branches[b.id] ?? 0 })),
    site,
  };
}

export function drawCardImage(ctx: CanvasRenderingContext2D, stats: CardShareStats): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  const glow = ctx.createRadialGradient(SHARE_WIDTH / 2, 0, 0, SHARE_WIDTH / 2, 0, SHARE_HEIGHT * 0.8);
  glow.addColorStop(0, GLOW);
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = FG_2;
  ctx.font = `600 34px ${BODY}`;
  ctx.fillText(`${stats.title} · ${t.playerCard.title}`.toUpperCase(), 90, 120);

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 300px ${BODY}`;
  ctx.fillText(String(stats.overall), 80, 420);
  ctx.fillStyle = FG_2;
  ctx.font = `600 44px ${BODY}`;
  ctx.fillText(t.playerCard.overall.toUpperCase(), 94, 490);

  ctx.fillStyle = FG;
  ctx.font = `600 40px ${BODY}`;
  const line = [stats.levelName, stats.details].filter(Boolean).join(" · ");
  if (line) ctx.fillText(line, 90, 560);

  let y = 700;
  for (const b of stats.branches) {
    ctx.fillStyle = FG;
    ctx.font = `600 32px ${BODY}`;
    ctx.textAlign = "left";
    ctx.fillText(b.name.toUpperCase(), 90, y);
    ctx.textAlign = "right";
    ctx.font = `700 40px ${BODY}`;
    ctx.fillText(String(b.value), SHARE_WIDTH - 90, y);
    const barY = y + 16;
    const barW = SHARE_WIDTH - 180;
    ctx.fillStyle = FG_FAINT;
    ctx.fillRect(90, barY, barW, 14);
    ctx.fillStyle = mutedBranchColor(b.color);
    ctx.fillRect(90, barY, (barW * Math.min(99, Math.max(0, b.value))) / 99, 14);
    y += 100;
  }

  ctx.textAlign = "center";
  ctx.fillStyle = FG_2;
  ctx.font = `400 30px ${BODY}`;
  ctx.fillText(stats.site, SHARE_WIDTH / 2, SHARE_HEIGHT - 50);
}

export async function renderCardImage(stats: CardShareStats): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load(`700 300px ${BODY}`), document.fonts.load(`600 40px ${BODY}`)]);
  } catch {
    // Fonts are a nicety. The fallbacks in the font stack still draw fine.
  }
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(t.share.cantDraw);
  drawCardImage(ctx, stats);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(t.share.imageFailed))), "image/png"));
}
