import { MAX_RATING } from "../lib/ratings";
import type { RatingSnapshot } from "../lib/ratingHistory";

export const CHART_W = 280;
export const CHART_H = 80;
/** Room kept above and below the line so its stroke is not clipped. */
const CHART_PAD_Y = 6;
/** The narrowest y-range, so a flat history sits in the middle of the chart instead of on its edge. */
const MIN_SPAN = 8;

export interface ChartRange {
  low: number;
  high: number;
}

/**
 * The y-range for the overall-rating line: the lowest and highest overall, padded, never narrower than MIN_SPAN
 * and never outside 0..MAX_RATING. A 2 to 5 history gets a range of about 8 points, not 0 to 99.
 */
export function chartRange(history: RatingSnapshot[]): ChartRange {
  const values = history.map((s) => s.overall);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(2, Math.ceil((max - min) * 0.2));
  const span = Math.min(MAX_RATING, Math.max(MIN_SPAN, max - min + 2 * pad));
  const low = Math.min(Math.max(0, (min + max) / 2 - span / 2), MAX_RATING - span);
  return { low, high: low + span };
}

/** Points for the overall-rating line, spread evenly over the snapshots and scaled to the chartRange. */
export function historyPoints(history: RatingSnapshot[]): string {
  if (history.length < 2) return "";
  const { low, high } = chartRange(history);
  const step = CHART_W / (history.length - 1);
  const drawable = CHART_H - 2 * CHART_PAD_Y;
  return history
    .map((s, i) => {
      const x = Math.round(i * step * 10) / 10;
      const y = Math.round((CHART_PAD_Y + drawable * (1 - (s.overall - low) / (high - low))) * 10) / 10;
      return `${x},${y}`;
    })
    .join(" ");
}
