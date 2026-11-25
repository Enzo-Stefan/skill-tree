// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Auth } from "../auth/useAuth";
import type { LeaderboardProfileState } from "../lib/useLeaderboardProfile";
import { t } from "../i18n";
import { SettingsScreen } from "./SettingsScreen";

afterEach(cleanup);

const auth: Auth = {
  configured: true,
  loading: false,
  account: { id: "u1", name: "Sam", email: null, avatarUrl: null },
  signInWithGoogle: async () => null,
  signOut: async () => {},
  deleteAccount: async () => null,
};

function renderSettings(leaderboard: LeaderboardProfileState) {
  render(
    <SettingsScreen
      auth={auth}
      treeName="Football"
      onCopy={vi.fn()}
      onReset={vi.fn()}
      onLanguage={vi.fn()}
      onDeleted={vi.fn()}
      leaderboard={leaderboard}
      onEditProfile={vi.fn()}
      onMessage={vi.fn()}
    />,
  );
}

describe("SettingsScreen leaderboard profile error", () => {
  const profile = { displayName: "Sam", countryCode: null, city: null, hemisphere: null, leaderboardOptIn: true };

  it("shows the error row, hides Leave, and Retry calls retry", () => {
    const retry = vi.fn();
    renderSettings({ profile, loading: false, error: true, retry, save: vi.fn(), leave: vi.fn() });
    expect(screen.queryByText(t.leaderboardProfile.leave)).toBeNull();
    fireEvent.click(screen.getByText(t.leaderboardProfile.loadFailed));
    expect(screen.getByText(t.leaderboardProfile.retry)).toBeTruthy();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows Leave when there is no error", () => {
    renderSettings({ profile, loading: false, error: false, retry: vi.fn(), save: vi.fn(), leave: vi.fn() });
    expect(screen.getByText(t.leaderboardProfile.leave)).toBeTruthy();
  });
});
