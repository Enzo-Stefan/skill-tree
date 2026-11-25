// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { TreeSummary } from "../lib/activeTree";
import { t } from "../i18n";
import { StrengthPanel } from "./StrengthPanel";

afterEach(cleanup);

const football: TreeSummary = { id: "football", title: "Football", shortName: "Football", tagline: "", done: 3, total: 40, rank: "Academy", active: true };
const strength: TreeSummary = { id: "weights", title: "Strength", shortName: "Strength", tagline: "Lift well", done: 2, total: 30, rank: "Novice", active: false };

// Reduced motion on, so closing finishes at once and no animation API is needed.
vi.stubGlobal("matchMedia", () => ({ matches: true }));

const handle = () => screen.getByRole("button", { name: t.strengthPanel.handleLabel });

describe("StrengthPanel", () => {
  it("renders nothing with one tree, or when Strength is open or not built", () => {
    for (const trees of [[football], [football, { ...strength, active: true }], [football, { ...strength, soon: true }]]) {
      const { container, unmount } = render(<StrengthPanel trees={trees} onSwitch={vi.fn()} />);
      expect(container.innerHTML).toBe("");
      unmount();
    }
  });

  it("opens with focus on the open button and keeps Tab inside", () => {
    render(<StrengthPanel trees={[football, strength]} onSwitch={vi.fn()} />);
    fireEvent.click(handle());
    const open = screen.getByRole("button", { name: t.strengthPanel.open });
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(open);
    const close = screen.getByRole("button", { name: t.strengthPanel.close });
    close.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(open);
  });

  it("closes on Escape and gives focus back to the handle", () => {
    render(<StrengthPanel trees={[football, strength]} onSwitch={vi.fn()} />);
    handle().focus();
    fireEvent.click(handle());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(handle());
  });

  it("gives focus back to the handle even when a click never focused it (Safari)", () => {
    render(<StrengthPanel trees={[football, strength]} onSwitch={vi.fn()} />);
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(handle());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(handle());
  });

  it("renders the panel on document.body, outside the header", () => {
    const { container } = render(<StrengthPanel trees={[football, strength]} onSwitch={vi.fn()} />);
    fireEvent.click(handle());
    expect(container.querySelector(".overlay")).toBeNull();
    expect(screen.getByRole("dialog").closest(".overlay")?.parentElement).toBe(document.body);
  });

  it("slides in once, not again when the parent re-renders", () => {
    const animate = vi.fn(() => ({}));
    Object.defineProperty(HTMLElement.prototype, "animate", { value: animate, configurable: true });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    try {
      const { rerender } = render(<StrengthPanel trees={[football, strength]} onSwitch={vi.fn()} />);
      fireEvent.click(handle());
      expect(animate).toHaveBeenCalledTimes(1);
      rerender(<StrengthPanel trees={[football, { ...strength, done: 3 }]} onSwitch={vi.fn()} />);
      expect(animate).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, "animate");
      vi.stubGlobal("matchMedia", () => ({ matches: true }));
    }
  });

  it("closes on a backdrop tap", () => {
    const { container } = render(<StrengthPanel trees={[football, strength]} onSwitch={vi.fn()} />);
    fireEvent.click(handle());
    fireEvent.click(container.ownerDocument.querySelector(".overlay")!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("picking Strength switches once, even on a double click", async () => {
    const onSwitch = vi.fn(() => new Promise<void>(() => {}));
    render(<StrengthPanel trees={[football, strength]} onSwitch={onSwitch} />);
    fireEvent.click(handle());
    const open = screen.getByRole("button", { name: t.strengthPanel.open });
    fireEvent.click(open);
    fireEvent.click(open);
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onSwitch).toHaveBeenCalledWith("weights");
    expect(screen.getByRole("button", { name: t.strengthPanel.opening }).getAttribute("aria-busy")).toBe("true");
  });

  it("lets the panel be used again when the switch resolves", async () => {
    const onSwitch = vi.fn(() => Promise.resolve());
    render(<StrengthPanel trees={[football, strength]} onSwitch={onSwitch} />);
    fireEvent.click(handle());
    const open = screen.getByRole("button", { name: t.strengthPanel.open });
    fireEvent.click(open);
    fireEvent.click(open);
    expect(onSwitch).toHaveBeenCalledTimes(1);
    const again = await screen.findByRole("button", { name: t.strengthPanel.open });
    expect(again.hasAttribute("disabled")).toBe(false);
    fireEvent.click(again);
    expect(onSwitch).toHaveBeenCalledTimes(2);
  });

  it("re-enables Open and still closes when onSwitch rejects", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const onSwitch = vi.fn(() => Promise.reject(new Error("offline")));
    render(<StrengthPanel trees={[football, strength]} onSwitch={onSwitch} />);
    fireEvent.click(handle());
    fireEvent.click(screen.getByRole("button", { name: t.strengthPanel.open }));
    const again = await screen.findByRole("button", { name: t.strengthPanel.open });
    expect(again.hasAttribute("disabled")).toBe(false);
    expect(error).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    error.mockRestore();
  });

  it("keeps focus inside the dialog while Open is disabled", () => {
    render(<StrengthPanel trees={[football, strength]} onSwitch={vi.fn(() => new Promise<void>(() => {}))} />);
    fireEvent.click(handle());
    fireEvent.click(screen.getByRole("button", { name: t.strengthPanel.open }));
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });
});
