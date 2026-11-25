// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { loadSupabase } from "../auth/client";
import { fetchIsAdmin } from "./adminApi";
import AdminEntry from "./AdminEntry";

vi.mock("../auth/client", () => ({ loadSupabase: vi.fn() }));
vi.mock("./adminApi", () => ({ fetchIsAdmin: vi.fn(), fetchReports: vi.fn(async () => []), resolveReport: vi.fn(), unhidePlayer: vi.fn() }));

function session(signedIn: boolean) {
  return { auth: { getSession: async () => ({ data: { session: signedIn ? { user: { id: "u1" } } : null } }) } };
}

function renderEntry() {
  render(
    <AdminEntry>
      <p>the normal app</p>
    </AdminEntry>,
  );
}

beforeEach(() => {
  vi.mocked(loadSupabase).mockReset();
  vi.mocked(fetchIsAdmin).mockReset();
});
afterEach(cleanup);

describe("AdminEntry", () => {
  it("shows the admin page to an admin", async () => {
    vi.mocked(loadSupabase).mockResolvedValue(session(true) as never);
    vi.mocked(fetchIsAdmin).mockResolvedValue(true);
    renderEntry();
    await screen.findByText("Leaderboard reports");
    expect(screen.queryByText("the normal app")).toBeNull();
  });

  it("shows the normal app to a signed-in player who is not an admin, without asking the database for reports", async () => {
    vi.mocked(loadSupabase).mockResolvedValue(session(true) as never);
    vi.mocked(fetchIsAdmin).mockResolvedValue(false);
    renderEntry();
    await screen.findByText("the normal app");
    expect(screen.queryByText("Leaderboard reports")).toBeNull();
  });

  it("shows the normal app to a signed-out visitor and does not check for admin", async () => {
    vi.mocked(loadSupabase).mockResolvedValue(session(false) as never);
    renderEntry();
    await screen.findByText("the normal app");
    expect(fetchIsAdmin).not.toHaveBeenCalled();
  });

  it("shows the normal app when accounts are not set up or the check fails", async () => {
    vi.mocked(loadSupabase).mockResolvedValueOnce(null);
    renderEntry();
    await screen.findByText("the normal app");
    cleanup();
    vi.mocked(loadSupabase).mockRejectedValueOnce(new Error("offline"));
    renderEntry();
    await waitFor(() => expect(screen.getByText("the normal app")).toBeTruthy());
  });

  it("shows nothing while it checks", () => {
    vi.mocked(loadSupabase).mockReturnValue(new Promise(() => {}));
    renderEntry();
    expect(screen.queryByText("the normal app")).toBeNull();
  });
});
