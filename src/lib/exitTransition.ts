import { useEffect, useRef, useState } from "react";

/** Exit animations stay under 250ms; this matches --dur-fast in index.css. */
export const EXIT_MS = 150;

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Keeps something mounted for `ms` after `open` turns false, so a CSS exit animation can play.
 * With prefers-reduced-motion it unmounts at once. `closing` is true during the exit.
 */
export function useExitTransition(open: boolean, ms = EXIT_MS): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (open) setMounted(true);
    else if (prefersReducedMotion()) setMounted(false);
    else timer.current = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(timer.current);
  }, [open, ms]);
  return { mounted: open || mounted, closing: !open && mounted && !prefersReducedMotion() };
}

/**
 * Fades out a copy of the screen being left. The copy is taken before React swaps the tab, laid over
 * the new one, inert, and removed when its animation ends.
 */
export function leaveScreen(content: HTMLElement | null, ms = EXIT_MS): void {
  if (!content || prefersReducedMotion() || typeof content.animate !== "function") return;
  const from = Array.from(content.children).find(
    (el): el is HTMLElement => el instanceof HTMLElement && !el.hidden && (el.classList.contains("screen") || el.classList.contains("train")),
  );
  if (!from) return;
  const copy = from.cloneNode(true) as HTMLElement;
  // A copy must not repeat ids, keep playing media, or bring the fixed skill sheet along.
  copy.removeAttribute("id");
  copy.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  copy.querySelectorAll("iframe, video, audio, .panel.sheet, .sheet-backdrop").forEach((el) => el.remove());
  copy.classList.add("screen-leaving");
  copy.setAttribute("aria-hidden", "true");
  copy.setAttribute("inert", "");
  content.appendChild(copy);
  const anim = copy.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(-12px)" }], {
    duration: ms * 0.8,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    fill: "forwards",
  });
  const remove = () => copy.remove();
  anim.onfinish = remove;
  anim.oncancel = remove;
}
