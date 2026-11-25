// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportedPlayer } from "./adminApi";
import { fetchReports, resolveReport, unhidePlayer } from "./adminApi";
import { AdminPage } from "./AdminPage";

vi.mock("./adminApi", () => ({ fetchReports: vi.fn(), resolveReport: vi.fn(), unhidePlayer: vi.fn() }));

const client = {} as SupabaseClient;

const target: ReportedPlayer = {
  rowKey: "key-1",
  displayName: "Target",
  countryCode: "AL",
  hidden: false,
  openCount: 2,
  lastReportedAt: "2026-11-25T07:00:00Z",
  reports: [
    { id: 11, reason: "rude name", reportedAt: "2026-11-25T07:00:00Z", status: "open", reporter: "Sam" },
    { id: 10, reason: "fake score", reportedAt: "2026-11-25T06:00:00Z", status: "open", reporter: "Alex" },
  ],
};

beforeEach(() => {
  vi.mocked(fetchReports).mockReset().mockResolvedValue([target]);
  vi.mocked(resolveReport).mockReset().mockResolvedValue();
  vi.mocked(unhidePlayer).mockReset().mockResolvedValue();
});
afterEach(cleanup);

describe("AdminPage", () => {
  it("lists open reports with the reporter and reason", async () => {
    render(<AdminPage client={client} />);
    await screen.findByText(/Target/);
    expect(fetchReports).toHaveBeenCalledWith(client, "open");
    expect(screen.getByText("“rude name”")).toBeTruthy();
    expect(screen.getByText(/by Sam/)).toBeTruthy();
    expect(screen.getByText(/by Alex/)).toBeTruthy();
  });

  it("shows an empty message", async () => {
    vi.mocked(fetchReports).mockResolvedValue([]);
    render(<AdminPage client={client} />);
    expect(await screen.findByText("No open reports.")).toBeTruthy();
  });

  it("dismisses one report and reloads", async () => {
    render(<AdminPage client={client} />);
    await screen.findByText(/Target/);
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]!);
    await waitFor(() => expect(resolveReport).toHaveBeenCalledWith(client, 11, "dismiss"));
    await waitFor(() => expect(fetchReports).toHaveBeenCalledTimes(2));
  });

  it("asks before hiding, and hides only after the confirmation", async () => {
    render(<AdminPage client={client} />);
    await screen.findByText(/Target/);
    fireEvent.click(screen.getByRole("button", { name: "Hide row" }));
    expect(resolveReport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, hide" }));
    await waitFor(() => expect(resolveReport).toHaveBeenCalledWith(client, 11, "hide"));
  });

  it("cancels a hide without calling the database", async () => {
    render(<AdminPage client={client} />);
    await screen.findByText(/Target/);
    fireEvent.click(screen.getByRole("button", { name: "Hide row" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Yes, hide" })).toBeNull();
    expect(resolveReport).not.toHaveBeenCalled();
  });

  it("shows hidden rows on the Resolved tab with an Unhide button", async () => {
    vi.mocked(fetchReports).mockImplementation(async (_c, which) =>
      which === "resolved" ? [{ ...target, hidden: true, openCount: 0, reports: target.reports.map((r) => ({ ...r, status: "actioned" as const })) }] : [],
    );
    render(<AdminPage client={client} />);
    fireEvent.click(screen.getByRole("tab", { name: "Resolved" }));
    await screen.findByText("Hidden");
    expect(screen.queryByRole("button", { name: "Hide row" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Unhide" }));
    await waitFor(() => expect(unhidePlayer).toHaveBeenCalledWith(client, "key-1"));
  });

  it("shows an error with Retry when the list fails to load", async () => {
    vi.mocked(fetchReports).mockRejectedValueOnce(new Error("offline"));
    render(<AdminPage client={client} />);
    expect((await screen.findByRole("alert")).textContent).toContain("offline");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText(/Target/);
  });

  it("shows the error when an action fails", async () => {
    vi.mocked(resolveReport).mockRejectedValueOnce(new Error("Not found."));
    render(<AdminPage client={client} />);
    await screen.findByText(/Target/);
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]!);
    expect((await screen.findByRole("alert")).textContent).toContain("Not found.");
  });
});
