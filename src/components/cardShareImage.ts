import type { Tree } from "../types";
import { MAX_RATING, type Ratings } from "../lib/ratings";
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
  const parts = [card.position ? t.playerCard.positions[card.position] : null, card.foot ? t.playerCard.footLabel[card.foot] : null].filter((p): p is string => p !== null);
  return {
    title: tree.title,
    levelName,
    details: parts.join(" · "),
    overall: ratings.overall,
    branches: tree.branches.map((b) => ({ name: b.name, color: b.color, value: ratings.branches[b.id] ?? 0 })),
    site,
  };
}

/** Smallest size the fit helper shrinks to before it truncates. */
const MIN_FONT_PX = 22;
const MARGIN = 90;
const TEXT_GAP = 40;

/**
 * Picks the largest font size (from maxPx down to MIN_FONT_PX) at which the text fits in maxWidth, and truncates
 * with an ellipsis when even the smallest size is too wide. Leaves ctx.font at the chosen size.
 */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, weight: number, maxPx: number): string {
  for (let px = maxPx; px >= MIN_FONT_PX; px -= 2) {
    ctx.font = `${weight} ${px}px ${BODY}`;
    if (ctx.measureText(text).width <= maxWidth) return text;
  }
  ctx.font = `${weight} ${MIN_FONT_PX}px ${BODY}`;
  const chars = Array.from(text);
  while (chars.length > 0 && ctx.measureText(`${chars.join("")}…`).width > maxWidth) chars.pop();
  return `${chars.join("")}…`;
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
  const contentWidth = SHARE_WIDTH - 2 * MARGIN;
  const header = fitText(ctx, `${stats.title} · ${t.playerCard.title}`.toUpperCase(), contentWidth, 600, 34);
  ctx.fillText(header, MARGIN, 120);

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 300px ${BODY}`;
  ctx.fillText(String(stats.overall), 80, 420);
  ctx.fillStyle = FG_2;
  ctx.font = `600 44px ${BODY}`;
  ctx.fillText(t.playerCard.overall.toUpperCase(), 94, 490);

  ctx.fillStyle = FG;
  const line = [stats.levelName, stats.details].filter(Boolean).join(" · ");
  if (line) ctx.fillText(fitText(ctx, line, contentWidth, 600, 40), MARGIN, 560);

  let y = 700;
  for (const b of stats.branches) {
    ctx.fillStyle = FG;
    ctx.font = `700 40px ${BODY}`;
    const value = String(b.value);
    const valueWidth = ctx.measureText(value).width;
    ctx.textAlign = "left";
    const name = fitText(ctx, b.name.toUpperCase(), contentWidth - valueWidth - TEXT_GAP, 600, 32);
    ctx.fillText(name, MARGIN, y);
    ctx.textAlign = "right";
    ctx.font = `700 40px ${BODY}`;
    ctx.fillText(value, SHARE_WIDTH - MARGIN, y);
    const barY = y + 16;
    ctx.fillStyle = FG_FAINT;
    ctx.fillRect(MARGIN, barY, contentWidth, 14);
    ctx.fillStyle = mutedBranchColor(b.color);
    ctx.fillRect(MARGIN, barY, (contentWidth * Math.min(MAX_RATING, Math.max(0, b.value))) / MAX_RATING, 14);
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
