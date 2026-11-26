/** Share of a branch passed, from 0 to 1. An empty branch counts as 0, never NaN. */
export function ringFraction(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, done / total));
}
