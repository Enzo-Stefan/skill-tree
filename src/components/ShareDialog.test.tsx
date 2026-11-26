// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
afterEach(cleanup);

describe("ShareDialog custom picture", () => {
  const custom: ShareCustom = { title: "Share my card", render: () => Promise.resolve(blob), alt: "My card alt", text: "My card text", fileName: "my-player-card.png" };

  it("uses the custom title, alt text and file name", async () => {
    render(<ShareDialog stats={stats} onClose={() => {}} custom={custom} />);
    expect(screen.getByRole("heading", { name: "Share my card" })).toBeTruthy();
    expect((await screen.findByAltText("My card alt")) as HTMLImageElement).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("link", { name: t.share.download }).getAttribute("download")).toBe("my-player-card.png"));
  });

  it("keeps the tree title when there is no custom picture", () => {
    render(<ShareDialog stats={stats} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: t.share.title })).toBeTruthy();
  });
});
