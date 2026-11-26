import type { RatingSnapshot } from "../lib/ratingHistory";

export const CHART_W = 280;
export const CHART_H = 80;

/** Points for the overall-rating line, spread evenly over the weeks and scaled to 0..99. */
export function historyPoints(history: RatingSnapshot[]): string {
  if (history.length < 2) return "";
  const step = CHART_W / (history.length - 1);
  return history.map((s, i) => `${Math.round(i * step * 10) / 10},${Math.round((CHART_H - (s.overall / 99) * CHART_H) * 10) / 10}`).join(" ");
}
