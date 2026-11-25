// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Auth } from "../auth/useAuth";
import type { LeaderboardRow, Tree } from "../types";
import { t } from "../i18n";
import { LeaderboardScreen } from "./LeaderboardScreen";

vi.mock("../auth/client", () => ({ loadSupabase: vi.fn(async () => ({ rpc: vi.fn() })) }));
vi.mock("../lib/leaderboardApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/leaderboardApi")>()),
  fetchLeaderboard: vi.fn(),
}));

afterEach(cleanup);

const auth: Auth = {
  configured: true,
  loading: false,
  account: { id: "u1", name: "Sam", email: null, avatarUrl: null },
  signInWithGoogle: async () => null,
  signOut: async () => {},
  deleteAccount: async () => null,
};
// Not the leaderboard tree, so the screen never queries the API.
const tree = { id: "other", title: "Other", tagline: "", branches: [], skills: [], levels: [] } as Tree;

function renderScreen(onRetryProfile = vi.fn()) {
  render(
    <LeaderboardScreen
      tree={tree}
      auth={auth}
      profile={null}
      profileLoading={false}
      profileError
      onRetryProfile={onRetryProfile}
      onBack={vi.fn()}
      onEditProfile={vi.fn()}
      onSignIn={vi.fn()}
      onMessage={vi.fn()}
    />,
  );
  return onRetryProfile;
}

describe("LeaderboardScreen profile load error", () => {
  it("shows the error and Retry, and hides the Join card", () => {
    renderScreen();
    expect(screen.getByRole("alert").textContent).toBe(t.leaderboardProfile.loadFailed);
    expect(screen.getByRole("button", { name: t.leaderboardProfile.retry })).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.leaderboard.join })).toBeNull();
  });

  it("calls onRetryProfile when Retry is clicked", () => {
    const onRetry = renderScreen();
    fireEvent.click(screen.getByRole("button", { name: t.leaderboardProfile.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("LeaderboardScreen report buttons", () => {
  const board = { id: "football", title: "Football", tagline: "", branches: [], skills: [], levels: [] } as Tree;
  const base = { countryCode: null, skills: 2, levelStep: 1, bestSprint: null };
  const others: LeaderboardRow = { ...base, rank: 1, rowKey: "row-other", displayName: "Ana", isMe: false };
  const mine: LeaderboardRow = { ...base, rank: 2, rowKey: "row-me", displayName: "Sam", isMe: true };

  it("gives every other row a Report button and none to the viewer's own row", async () => {
    const { fetchLeaderboard } = await import("../lib/leaderboardApi");
    vi.mocked(fetchLeaderboard).mockResolvedValue({ top: [others, mine], me: null });
    render(
      <LeaderboardScreen
        tree={board}
        auth={auth}
        profile={null}
        profileLoading={false}
        profileError={false}
        onRetryProfile={vi.fn()}
        onBack={vi.fn()}
        onEditProfile={vi.fn()}
        onSignIn={vi.fn()}
        onMessage={vi.fn()}
      />,
    );
    expect(await screen.findByText("Ana")).toBeTruthy();
    expect(screen.getByRole("button", { name: t.leaderboard.reportTitle("Ana") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.leaderboard.reportTitle("Sam") })).toBeNull();
    expect(screen.getByText(t.leaderboard.you).closest("li")?.querySelector("button")).toBeNull();
  });
});
