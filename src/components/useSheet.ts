import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject, type SyntheticEvent } from "react";
import { SHEET_DRAG_SLOP, settleSheet } from "./sheetDrag";

interface Drag {
  pointerId: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  moving: boolean;
}

interface Sheet {
  /** True at full height, false at half height. */
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  /** On the sheet itself: its half height, measured. */
  style: CSSProperties | undefined;
  /** On the grabber strip: drag up for full height, down for half or to close. */
  handleProps: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
    onClickCapture: (e: SyntheticEvent) => void;
  };
  /** On the sheet: scrolling the half-height sheet opens it to full height. */
  onScroll: () => void;
}

/**
 * The phone skill sheet's two heights. Half height ends right below `main` (the name, the test and its
 * buttons), so it fits the text whatever the language or text size. `key` is the open skill: a new
 * skill starts at half height.
 */
export function useSheet(
  enabled: boolean,
  key: string,
  sheet: RefObject<HTMLElement | null>,
  main: RefObject<HTMLElement | null>,
  onClose: () => void,
): Sheet {
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const expanded = enabled && expandedFor === key;
  const [half, setHalf] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);
  // A drag that started on Close must not also click it.
  const dragged = useRef(false);

  useLayoutEffect(() => {
    const box = sheet.current;
    const top = main.current;
    if (!enabled || !box || !top) return;
    const measure = () => {
      const padding = parseFloat(getComputedStyle(box).paddingBottom) || 0;
      setHalf(Math.ceil(top.offsetTop + top.offsetHeight + padding));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(top);
    return () => observer.disconnect();
  }, [enabled, key, sheet, main]);

  // Back at half height, the top of the sheet is what fits, so scroll back to it.
  useEffect(() => {
    if (!expanded && sheet.current) sheet.current.scrollTop = 0;
  }, [expanded, sheet]);

  function setExpanded(next: boolean) {
    setExpandedFor(next ? key : null);
  }

  function endDrag(e: PointerEvent<HTMLElement>, cancelled: boolean) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    const box = sheet.current;
    if (!d.moving || !box) return;
    dragged.current = true;
    box.style.height = "";
    box.classList.remove("dragging");
    if (cancelled) return;
    const next = settleSheet(expanded ? "full" : "half", e.clientY - d.startY, d.velocity, d.startHeight);
    if (next === "close") onClose();
    else setExpanded(next === "full");
  }

  return {
    expanded,
    setExpanded,
    style: enabled && half ? ({ "--sheet-half": `${half}px` } as CSSProperties) : undefined,
    handleProps: {
      onPointerDown: (e) => {
        dragged.current = false;
        if (!enabled || !sheet.current || (e.pointerType === "mouse" && e.button !== 0)) return;
        const now = e.timeStamp;
        drag.current = {
          pointerId: e.pointerId,
          startY: e.clientY,
          startHeight: sheet.current.offsetHeight,
          lastY: e.clientY,
          lastTime: now,
          velocity: 0,
          moving: false,
        };
      },
      onPointerMove: (e) => {
        const d = drag.current;
        const box = sheet.current;
        if (!d || d.pointerId !== e.pointerId || !box) return;
        const dy = e.clientY - d.startY;
        if (!d.moving) {
          if (Math.abs(dy) < SHEET_DRAG_SLOP) return;
          d.moving = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          box.classList.add("dragging");
        }
        const elapsed = e.timeStamp - d.lastTime;
        if (elapsed > 0) d.velocity = (e.clientY - d.lastY) / elapsed;
        d.lastY = e.clientY;
        d.lastTime = e.timeStamp;
        box.style.height = `${Math.max(0, Math.min(window.innerHeight, d.startHeight - dy))}px`;
      },
      onPointerUp: (e) => endDrag(e, false),
      onPointerCancel: (e) => endDrag(e, true),
      onClickCapture: (e) => {
        if (!dragged.current) return;
        dragged.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
    },
    onScroll: () => {
      if (enabled && !expanded && (sheet.current?.scrollTop ?? 0) > SHEET_DRAG_SLOP) setExpanded(true);
    },
  };
}
