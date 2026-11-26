import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode, type Ref } from "react";
import { t } from "../i18n";
import { baseView, centerOn, constrain, distance, fitView, minScale, pinchView, wheelFactor, zoomAt, type Pt, type Size, type View } from "./zoomPan";

export interface ZoomPaneHandle {
  /** Shows the whole map. */
  fit: () => void;
  /** Moves a skill in the map to the middle of the pane. */
  centerOn: (el: HTMLElement) => void;
}

interface Props {
  ref?: Ref<ZoomPaneHandle>;
  children: ReactNode;
  className?: string;
}

/** Finger or mouse movement (px) before a press becomes a drag. Below it, a tap still opens the skill. */
const DRAG_PX = 6;
const ZOOM_STEP = 1.4;
const NONE: Size = { width: 0, height: 0 };

/**
 * A pane the map can be zoomed and moved around in: two fingers to pinch and move, the mouse or a sideways
 * finger drag to pan (an up/down finger drag scrolls the page), Ctrl or Cmd plus the wheel, or a trackpad pinch, to zoom (plain scrolling scrolls the page), and buttons for zoom in, zoom out and fit.
 * The map is drawn at its own size and scaled with a CSS transform; the maths is in zoomPan.ts.
 */
export function ZoomPane({ ref, children, className = "" }: Props) {
  const paneRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [view, setViewState] = useState<View | null>(null);
  const viewRef = useRef<View | null>(null);
  const [smooth, setSmooth] = useState(false);
  const sizes = useRef<{ pane: Size; content: Size }>({ pane: NONE, content: NONE });
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{ view: View; from: Pt[] } | null>(null);
  const dragged = useRef(false);
  const smoothTimer = useRef<number | undefined>(undefined);

  const setView = useCallback((next: View, animate = false) => {
    const { pane, content } = sizes.current;
    const v = pane.width > 0 && content.width > 0 ? constrain(next, content, pane) : next;
    viewRef.current = v;
    window.clearTimeout(smoothTimer.current);
    setSmooth(animate);
    if (animate) smoothTimer.current = window.setTimeout(() => setSmooth(false), 350);
    setViewState(v);
  }, []);

  const lowest = () => minScale(sizes.current.content, sizes.current.pane);
  const centre = (): Pt => ({ x: sizes.current.pane.width / 2, y: sizes.current.pane.height / 2 });

  useLayoutEffect(() => {
    const pane = paneRef.current;
    const map = mapRef.current;
    if (!pane || !map) return;
    const measure = () => {
      // A hidden Train tab measures 0. Keep the last real sizes.
      if (pane.clientWidth === 0 || map.offsetWidth === 0) return;
      sizes.current = { pane: { width: pane.clientWidth, height: pane.clientHeight }, content: { width: map.offsetWidth, height: map.offsetHeight } };
      if (!viewRef.current) setView(baseView(sizes.current.content, sizes.current.pane));
      else setView(viewRef.current);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    observer.observe(map);
    return () => observer.disconnect();
  }, [setView]);

  useEffect(() => () => window.clearTimeout(smoothTimer.current), []);

  // Not a React prop: React's wheel listener is passive, and zooming needs preventDefault.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const onWheel = (e: WheelEvent) => {
      const v = viewRef.current;
      // Plain scroll belongs to the page. A trackpad pinch arrives as a wheel event with ctrlKey set.
      if (!v || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = pane.getBoundingClientRect();
      const at = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setView(zoomAt(v, at, v.scale * wheelFactor(e.deltaY, e.deltaMode), lowest()));
    };
    pane.addEventListener("wheel", onWheel, { passive: false });
    return () => pane.removeEventListener("wheel", onWheel);
  }, [setView]);

  const local = (e: PointerEvent): Pt => {
    const rect = paneRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  function restart() {
    const v = viewRef.current;
    gesture.current = v && pointers.current.size > 0 ? { view: v, from: [...pointers.current.values()] } : null;
  }

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 1) dragged.current = false;
    restart();
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, local(e));
    const { view: start, from } = gesture.current;
    const now = [...pointers.current.values()];
    if (now.length >= 2 && from.length >= 2) {
      dragged.current = true;
      setView(pinchView(start, [from[0], from[1]], [now[0], now[1]], lowest()));
    } else if (now.length === 1 && from.length === 1) {
      if (!dragged.current && distance(now[0], from[0]) < DRAG_PX) return;
      if (!dragged.current) e.currentTarget.setPointerCapture(e.pointerId);
      dragged.current = true;
      setView({ scale: start.scale, x: start.x + now[0].x - from[0].x, y: start.y + now[0].y - from[0].y });
    }
  }

  function onPointerEnd(e: PointerEvent) {
    pointers.current.delete(e.pointerId);
    restart();
  }

  // A drag that ends over a skill must not open it.
  function onClickCapture(e: PointerEvent | React.MouseEvent) {
    if (!dragged.current) return;
    e.preventDefault();
    e.stopPropagation();
    dragged.current = false;
  }

  const centerOnEl = useCallback(
    (el: HTMLElement, animate: boolean) => {
      const map = mapRef.current;
      const v = viewRef.current;
      if (!map || !v) return;
      const box = map.getBoundingClientRect();
      const k = box.width / map.offsetWidth || 1;
      const r = el.getBoundingClientRect();
      const target = { x: (r.left + r.width / 2 - box.left) / k, y: (r.top + r.height / 2 - box.top) / k };
      setView(centerOn(target, Math.max(v.scale, 0.7), sizes.current.pane), animate);
    },
    [setView],
  );

  const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fit = useCallback(() => setView(fitView(sizes.current.content, sizes.current.pane), !calm()), [setView]);

  useImperativeHandle(ref, () => ({ fit, centerOn: (el) => centerOnEl(el, !calm()) }), [fit, centerOnEl]);

  const zoomBy = (factor: number) => {
    const v = viewRef.current;
    if (v) setView(zoomAt(v, centre(), v.scale * factor, lowest()), !calm());
  };

  // Keyboard focus on a skill that is off screen brings it into view.
  function onFocus(e: FocusEvent<HTMLDivElement>) {
    const pane = paneRef.current;
    if (!pane) return;
    pane.scrollTop = 0;
    pane.scrollLeft = 0;
    const r = e.target.getBoundingClientRect();
    const p = pane.getBoundingClientRect();
    if (r.left < p.left || r.right > p.right || r.top < p.top || r.bottom > p.bottom) centerOnEl(e.target, !calm());
  }

  return (
    <div className={`zoom-wrap ${className}`}>
      <div
        className="zoom-pane"
        ref={paneRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
        onFocus={onFocus}
      >
        <div
          className={`zoom-map${smooth ? " smooth" : ""}`}
          ref={mapRef}
          style={{ transform: view ? `translate(${view.x}px, ${view.y}px) scale(${view.scale})` : undefined, visibility: view ? undefined : "hidden" }}
        >
          {children}
        </div>
      </div>
      <div className="zoom-controls" role="group" aria-label={t.tree.zoomControls}>
        <button type="button" className="zoom-btn" aria-label={t.tree.zoomIn} onClick={() => zoomBy(ZOOM_STEP)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button type="button" className="zoom-btn" aria-label={t.tree.zoomOut} onClick={() => zoomBy(1 / ZOOM_STEP)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
        </button>
        <button type="button" className="zoom-btn" aria-label={t.tree.fit} title={t.tree.fit} onClick={fit}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
        </button>
      </div>
    </div>
  );
}
