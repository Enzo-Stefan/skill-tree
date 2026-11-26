// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { t } from "../i18n";
import { ZoomPane } from "./ZoomPane";
import { fitView, minScale, MIN_TAP_SCALE } from "./zoomPan";

// jsdom does no layout. The pane reads clientWidth/clientHeight, the map reads offsetWidth/offsetHeight.
const PANE = { width: 400, height: 600 };
const CONTENT = { width: 1000, height: 800 };

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => PANE.width });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => PANE.height });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => CONTENT.width });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => CONTENT.height });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  // Reduced motion on, so the zoom and fit buttons change the view at once.
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const key of ["clientWidth", "clientHeight", "offsetWidth", "offsetHeight"]) delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
});

function renderPane() {
  const { container } = render(
    <ZoomPane>
      <div>map</div>
    </ZoomPane>,
  );
  const pane = container.querySelector<HTMLElement>(".zoom-pane")!;
  const map = container.querySelector<HTMLElement>(".zoom-map")!;
  return { pane, map };
}

/** The scale the map is drawn at, read from its transform (translate(...) scale(s)). */
function scaleOf(map: HTMLElement): number {
  const m = /scale\(([-\d.e]+)\)/.exec(map.style.transform);
  if (!m) throw new Error(`no scale in transform "${map.style.transform}"`);
  return Number(m[1]);
}

const zoomIn = () => screen.getByRole("button", { name: t.tree.zoomIn });
const zoomOut = () => screen.getByRole("button", { name: t.tree.zoomOut });
const fit = () => screen.getByRole("button", { name: t.tree.fit });

describe("ZoomPane buttons", () => {
  it("shows the zoom in, zoom out and fit buttons inside a labelled group", () => {
    renderPane();
    const group = screen.getByRole("group", { name: t.tree.zoomControls });
    expect(group.contains(zoomIn())).toBe(true);
    expect(group.contains(zoomOut())).toBe(true);
    expect(group.contains(fit())).toBe(true);
  });

  it("zooms in and out when the buttons are pressed", () => {
    const { map } = renderPane();
    const start = scaleOf(map);
    fireEvent.click(zoomIn());
    const bigger = scaleOf(map);
    expect(bigger).toBeGreaterThan(start);
    fireEvent.click(zoomOut());
    fireEvent.click(zoomOut());
    expect(scaleOf(map)).toBeLessThan(bigger);
  });

  it("never zooms out below the fit scale from minScale", () => {
    const { map } = renderPane();
    const floor = minScale(CONTENT, PANE);
    expect(floor).toBeCloseTo(MIN_TAP_SCALE, 5);
    for (let i = 0; i < 30; i++) fireEvent.click(zoomOut());
    expect(scaleOf(map)).toBeCloseTo(floor, 5);
  });

  it("fit shows the whole map again after zooming in", () => {
    const { map } = renderPane();
    const fitted = fitView(CONTENT, PANE).scale;
    for (let i = 0; i < 3; i++) fireEvent.click(zoomIn());
    expect(scaleOf(map)).not.toBeCloseTo(fitted, 5);
    fireEvent.click(fit());
    expect(scaleOf(map)).toBeCloseTo(fitted, 5);
  });
});

describe("ZoomPane wheel", () => {
  it("Ctrl plus wheel zooms in and cancels the default", () => {
    const { pane, map } = renderPane();
    const start = scaleOf(map);
    const notCancelled = fireEvent.wheel(pane, { deltaY: -100, ctrlKey: true, clientX: 200, clientY: 300 });
    expect(notCancelled).toBe(false);
    expect(scaleOf(map)).toBeGreaterThan(start);
  });

  it("Cmd plus wheel also zooms", () => {
    const { pane, map } = renderPane();
    // The start view is already at the fit floor, so zoom in first to have room to zoom out.
    fireEvent.click(zoomIn());
    const start = scaleOf(map);
    fireEvent.wheel(pane, { deltaY: 100, metaKey: true, clientX: 200, clientY: 300 });
    expect(scaleOf(map)).toBeLessThan(start);
  });

  it("plain wheel does not preventDefault and does not change the zoom", () => {
    const { pane, map } = renderPane();
    const start = scaleOf(map);
    const notCancelled = fireEvent.wheel(pane, { deltaY: -100, clientX: 200, clientY: 300 });
    expect(notCancelled).toBe(true);
    expect(scaleOf(map)).toBe(start);
  });

  it("Ctrl plus wheel never zooms out below the fit scale", () => {
    const { pane, map } = renderPane();
    for (let i = 0; i < 20; i++) fireEvent.wheel(pane, { deltaY: 500, ctrlKey: true, clientX: 200, clientY: 300 });
    expect(scaleOf(map)).toBeCloseTo(minScale(CONTENT, PANE), 5);
  });
});
