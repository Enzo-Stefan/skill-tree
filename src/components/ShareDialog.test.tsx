// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareDialog, type ShareCustom } from "./ShareDialog";
import type { ShareStats } from "./shareImage";
import { t } from "../i18n";

const stats: ShareStats = { title: "Football", done: 3, total: 10, rank: "Beginner" } as ShareStats;
const blob = new Blob(["x"], { type: "image/png" });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
});

describe("ShareDialog custom picture", () => {
  const custom: ShareCustom = { title: "Share my card", render: () => Promise.resolve(blob), alt: "My card alt", text: "My card text", fileName: "my-player-card.png" };

  it("uses the custom title, alt text and file name", async () => {
    render(<ShareDialog stats={stats} onClose={() => {}} custom={custom} />);
    expect(screen.getByRole("heading", { name: "Share my card" })).toBeTruthy();
    expect((await screen.findByAltText("My card alt")) as HTMLImageElement).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("link", { name: t.share.download }).getAttribute("download")).toBe("my-player-card.png"));
  });

  it("shares the custom picture as a file with the custom text", async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { share, canShare: () => true });
    render(<ShareDialog stats={stats} onClose={() => {}} custom={custom} />);
    fireEvent.click(await screen.findByRole("button", { name: t.share.share }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const arg = (share.mock.calls[0] as unknown as [{ files: File[]; text: string }])[0];
    expect(arg.text).toBe("My card text");
    expect(arg.files[0]!.name).toBe("my-player-card.png");
  });

  it("shows the error when the custom picture cannot be drawn, and offers no download", async () => {
    const failing: ShareCustom = { ...custom, render: () => Promise.reject(new Error("Could not draw")) };
    render(<ShareDialog stats={stats} onClose={() => {}} custom={failing} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Could not draw");
    expect(screen.queryByRole("link", { name: t.share.download })).toBeNull();
  });

  it("keeps the tree title when there is no custom picture", () => {
    render(<ShareDialog stats={stats} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: t.share.title })).toBeTruthy();
  });
});
