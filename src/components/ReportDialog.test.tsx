// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { LeaderboardRow } from "../types";
import { t } from "../i18n";
import { LeaderboardError, reportRow } from "../lib/leaderboardApi";
import { ReportDialog } from "./ReportDialog";

vi.mock("../auth/client", () => ({ loadSupabase: vi.fn(async () => ({ rpc: vi.fn() })) }));
vi.mock("../lib/leaderboardApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/leaderboardApi")>()),
  reportRow: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
  vi.mocked(reportRow).mockReset();
});

const row: LeaderboardRow = {
  rank: 4,
  rowKey: "row-key-1",
  displayName: "Sam Rival",
  countryCode: null,
  skills: 3,
  levelStep: 2,
  bestSprint: null,
  isMe: false,
};

function renderDialog(onClose = vi.fn(), onSent = vi.fn()) {
  render(<ReportDialog row={row} onClose={onClose} onSent={onSent} />);
  return { onClose, onSent };
}

function reasonBox() {
  return screen.getByRole("textbox") as HTMLTextAreaElement;
}

function sendButton() {
  return screen.getByRole("button", { name: t.leaderboard.reportSend }) as HTMLButtonElement;
}

describe("ReportDialog", () => {
  it("keeps Send disabled while the reason is empty or only spaces", () => {
    renderDialog();
    expect(sendButton().disabled).toBe(true);
    fireEvent.change(reasonBox(), { target: { value: "   \n\t " } });
    expect(sendButton().disabled).toBe(true);
    fireEvent.change(reasonBox(), { target: { value: "  looks fake " } });
    expect(sendButton().disabled).toBe(false);
  });

  it("stops the reason at 300 characters and shows the count", () => {
    renderDialog();
    fireEvent.change(reasonBox(), { target: { value: "a".repeat(310) } });
    expect(reasonBox().value.length).toBe(300);
    expect(screen.getByText(t.leaderboard.reportCount(300, 300))).toBeTruthy();
  });

  it("sends the trimmed reason with the row key, then reports success", async () => {
    vi.mocked(reportRow).mockResolvedValue();
    const { onClose, onSent } = renderDialog();
    fireEvent.change(reasonBox(), { target: { value: "  the score is fake  " } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
    expect(reportRow).toHaveBeenCalledWith(expect.anything(), "row-key-1", "the score is fake");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("focuses the reason box when it opens", () => {
    renderDialog();
    expect(document.activeElement).toBe(reasonBox());
  });

  it("links the character count to the reason box", () => {
    renderDialog();
    const countId = reasonBox().getAttribute("aria-describedby");
    expect(countId).toBeTruthy();
    expect(document.getElementById(countId!)?.textContent).toBe(t.leaderboard.reportCount(0, 300));
  });

  it("sends only once when Send is pressed again while the report is going", async () => {
    vi.mocked(reportRow).mockReturnValue(new Promise(() => {}));
    renderDialog();
    fireEvent.change(reasonBox(), { target: { value: "spam" } });
    fireEvent.click(sendButton());
    fireEvent.click(sendButton());
    await waitFor(() => expect(reportRow).toHaveBeenCalledTimes(1));
    expect(reasonBox().disabled).toBe(true);
  });

  it("returns focus to the reason box after a failed send", async () => {
    vi.mocked(reportRow).mockRejectedValue(new LeaderboardError("failed", "connection reset"));
    renderDialog();
    fireEvent.change(reasonBox(), { target: { value: "spam" } });
    sendButton().focus();
    fireEvent.click(sendButton());
    await screen.findByRole("alert");
    expect(document.activeElement).toBe(reasonBox());
  });

  it("shows the database's sign-in message and offers Close instead of Cancel", async () => {
    vi.mocked(reportRow).mockRejectedValue(new LeaderboardError("failed", "Sign in to report a row.", "28000"));
    renderDialog();
    fireEvent.change(reasonBox(), { target: { value: "spam" } });
    fireEvent.click(sendButton());
    expect((await screen.findByRole("alert")).textContent).toBe(t.leaderboard.reportSignIn);
    expect(screen.getByRole("button", { name: t.leaderboard.close })).toBeTruthy();
    expect(sendButton().disabled).toBe(true);
  });

  it("shows the database's daily limit message", async () => {
    vi.mocked(reportRow).mockRejectedValue(new LeaderboardError("failed", "Too many reports today."));
    renderDialog();
    fireEvent.change(reasonBox(), { target: { value: "spam" } });
    fireEvent.click(sendButton());
    expect((await screen.findByRole("alert")).textContent).toBe(t.leaderboard.reportTooMany);
  });

  it("shows the generic failure for any other error and keeps the dialog open", async () => {
    vi.mocked(reportRow).mockRejectedValue(new LeaderboardError("failed", "connection reset"));
    const { onSent } = renderDialog();
    fireEvent.change(reasonBox(), { target: { value: "spam" } });
    fireEvent.click(sendButton());
    expect((await screen.findByRole("alert")).textContent).toBe(t.leaderboard.reportFailed);
    expect(onSent).not.toHaveBeenCalled();
    expect(reasonBox().value).toBe("spam");
  });

  it("closes on Escape", () => {
    const { onClose } = renderDialog();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
