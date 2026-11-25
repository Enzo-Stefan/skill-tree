import type { Tree } from "../types";

/** Which way the tree slides when the area changes: 1 comes in from the right (a later area), -1 from the left, 0 no slide. "All" (null) counts as before the first area. */
export function slideDirection(tree: Tree, from: string | null, to: string | null): -1 | 0 | 1 {
  const index = (id: string | null) => (id === null ? -1 : tree.branches.findIndex((b) => b.id === id));
  const a = index(from);
  const b = index(to);
  if (a === b) return 0;
  return b > a ? 1 : -1;
}

const SLIDE_MS = 260;

function canAnimate(el: HTMLElement | null): el is HTMLElement {
  return !!el && typeof el.animate === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Slides an element in from the side. Does nothing when the person asked for less motion or the browser can't animate. */
export function slideIn(el: HTMLElement | null, direction: -1 | 0 | 1): void {
  if (direction === 0 || !canAnimate(el)) return;
  el.animate(
    [
      { transform: `translateX(${direction * 48}px)`, opacity: 0 },
      { transform: "translateX(0)", opacity: 1 },
    ],
    { duration: SLIDE_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  );
}

const PANEL_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Slides a side panel in from the right edge. Does nothing under reduced motion or when the browser can't animate. */
export function panelIn(el: HTMLElement | null): void {
  if (!canAnimate(el)) return;
  el.animate(
    [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }],
    { duration: SLIDE_MS, easing: PANEL_EASING },
  );
}

/** Slides a side panel back out to the right, then calls `done`. Under reduced motion it calls `done` at once. */
export function panelOut(el: HTMLElement | null, done: () => void): void {
  if (!canAnimate(el)) {
    done();
    return;
  }
  const animation = el.animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(100%)" }],
    { duration: SLIDE_MS, easing: PANEL_EASING, fill: "forwards" },
  );
  animation.onfinish = done;
  animation.oncancel = done;
}
