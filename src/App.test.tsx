// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { t } from "./i18n";
import App from "./App";

afterEach(cleanup);

// jsdom has no matchMedia; "no" to everything keeps the phone layout and reduced motion off the test's path.
vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });

describe("App Strength handle", () => {
  it("shows the Strength handle next to the area pill in the Train header and opens the panel", () => {
    render(<App />);
    const handle = screen.getByRole("button", { name: t.strengthPanel.handleLabel });
    const row = handle.closest(".area-row");
    expect(row).not.toBeNull();
    expect(row?.querySelector(".area-pill")).not.toBeNull();
    fireEvent.click(handle);
    expect(screen.getByRole("dialog", { name: t.strengthPanel.title })).not.toBeNull();
  });
});
