// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Auth } from "../auth/useAuth";
import type { Tree } from "../types";
import { t } from "../i18n";
import { LeaderboardScreen } from "./LeaderboardScreen";

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
