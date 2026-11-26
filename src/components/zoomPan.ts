// The maths behind the zoomable tree map: a view is how the map is scaled and where it sits.
// A map point (mx, my) is drawn at (x + mx * scale, y + my * scale) inside the pane.

export interface View {
  scale: number;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Pt {
  x: number;
  y: number;
}

export const MAX_SCALE = 2.5;
/** Skill circles are 52px (3.25rem) at scale 1; this is the scale at which they are still 44px, the touch target minimum. */
export const MIN_TAP_SCALE = 44 / 52;
/** How much of the map must stay on screen when panning, in pixels. */
const KEEP_PX = 80;

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The whole map in view, centred, never enlarged past 100% and never smaller than `floor` (so tap targets stay 44px; a map that doesn't fit then overflows the pane). */
export function fitView(content: Size, pane: Size, padding = 16, floor = MIN_TAP_SCALE): View {
  const ratio = (room: number, size: number) => (size > 0 ? (room - 2 * padding) / size : 1);
  const fit = Math.min(1, ratio(pane.width, content.width), ratio(pane.height, content.height));
  const scale = Math.max(Number.isFinite(fit) ? fit : 1, Math.min(floor, 1));
  return { scale, x: (pane.width - content.width * scale) / 2, y: (pane.height - content.height * scale) / 2 };
}

/** The starting view: the map as wide as the pane (up to 100%), showing its base, since the tree grows upward. */
export function baseView(content: Size, pane: Size, padding = 16, floor = MIN_TAP_SCALE): View {
  const wide = content.width > 0 ? (pane.width - 2 * padding) / content.width : 1;
  const scale = Math.max(Math.min(1, Number.isFinite(wide) ? wide : 1), Math.min(floor, 1));
  return { scale, x: (pane.width - content.width * scale) / 2, y: pane.height - content.height * scale - padding };
}

/** The smallest scale allowed: a little under the one that fits everything. */
export function minScale(content: Size, pane: Size): number {
  return fitView(content, pane).scale * 0.8;
}

/** Keeps part of the map on screen: a map smaller than the pane stays centred, a larger one can't leave it. */
export function constrain(view: View, content: Size, pane: Size): View {
  const w = content.width * view.scale;
  const h = content.height * view.scale;
  const axis = (pos: number, size: number, room: number) =>
    size + 2 * KEEP_PX <= room ? (room - size) / 2 : clamp(pos, KEEP_PX - size, room - KEEP_PX);
  return { scale: view.scale, x: axis(view.x, w, pane.width), y: axis(view.y, h, pane.height) };
}

/** Changes the scale and keeps the map point under `at` (pane coordinates) where it is. */
export function zoomAt(view: View, at: Pt, scale: number, lo: number, hi = MAX_SCALE): View {
  const next = clamp(scale, lo, hi);
  const k = next / view.scale;
  return { scale: next, x: at.x - (at.x - view.x) * k, y: at.y - (at.y - view.y) * k };
}

/** The scale factor for one wheel event. Wheel steps in lines or pages count more than pixels. */
export function wheelFactor(deltaY: number, deltaMode = 0): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-clamp(px, -240, 240) * 0.0018);
}

export function distance(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export const midpoint = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Two fingers: the view when they started, moved to where they are now. Scales by the change in spread and follows the midpoint. */
export function pinchView(start: View, from: [Pt, Pt], to: [Pt, Pt], lo: number, hi = MAX_SCALE): View {
  const spread = distance(from[0], from[1]);
  const ratio = spread < 1 ? 1 : distance(to[0], to[1]) / spread;
  const scale = clamp(start.scale * ratio, lo, hi);
  const k = scale / start.scale;
  const a = midpoint(from[0], from[1]);
  const b = midpoint(to[0], to[1]);
  return { scale, x: b.x - (a.x - start.x) * k, y: b.y - (a.y - start.y) * k };
}

/** A view that puts the map point `target` in the middle of the pane at the given scale. */
export function centerOn(target: Pt, scale: number, pane: Size): View {
  return { scale, x: pane.width / 2 - target.x * scale, y: pane.height / 2 - target.y * scale };
}
