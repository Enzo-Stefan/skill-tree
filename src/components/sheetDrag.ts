/** The two resting heights of the skill sheet on phones. */
export type SheetHeight = "half" | "full";

/** How far a drag has to go (px) before the sheet changes height or closes. */
export const SHEET_DRAG_DISTANCE = 64;
/** A drag faster than this (px per ms) counts as a flick and goes the way it was flicked, even when short. */
export const SHEET_FLICK_SPEED = 0.5;
/** Movement (px) before a press on the grabber counts as a drag, so a tap on Close still clicks. */
export const SHEET_DRAG_SLOP = 8;

/**
 * Where the sheet goes when a drag ends.
 *
 * @param from The height the drag started at.
 * @param dy How far the finger moved, down positive.
 * @param velocity The finger's speed at release, px per ms, down positive.
 * @param sheetHeight The sheet's height when the drag started. From full, dragging down most of it closes the sheet.
 */
export function settleSheet(from: SheetHeight, dy: number, velocity: number, sheetHeight: number): SheetHeight | "close" {
  const flickUp = velocity < -SHEET_FLICK_SPEED && dy < 0;
  const flickDown = velocity > SHEET_FLICK_SPEED && dy > 0;
  const up = dy < -SHEET_DRAG_DISTANCE || flickUp;
  const down = dy > SHEET_DRAG_DISTANCE || flickDown;
  if (from === "half") {
    if (up) return "full";
    if (down) return "close";
    return "half";
  }
  if (dy > sheetHeight * 0.6) return "close";
  if (down) return "half";
  return "full";
}

/** A finger that has been still this long (ms) before release isn't flicking, whatever its last movement speed was. */
export const SHEET_FLICK_STALE_MS = 100;

/** The speed to judge a release by: the last measured speed, or 0 when the finger paused before lifting. */
export function releaseVelocity(velocity: number, msSinceLastMove: number): number {
  return msSinceLastMove > SHEET_FLICK_STALE_MS ? 0 : velocity;
}
