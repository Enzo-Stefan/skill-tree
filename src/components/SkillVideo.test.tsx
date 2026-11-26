// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SkillVideo } from "./SkillVideo";
import { t } from "../i18n";

const YOUTUBE = "https://www.youtube.com/watch?v=bH3vhjIGgpQ";

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

describe("SkillVideo offline", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a clear note instead of an empty box when there is no connection", () => {
    setOnline(false);
    render(<SkillVideo link={YOUTUBE} title="Juggle 20" />);
    expect(screen.getByRole("note").textContent).toContain(t.video.offlineTitle);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the play button when online", () => {
    setOnline(true);
    render(<SkillVideo link={YOUTUBE} title="Juggle 20" />);
    expect(screen.getByRole("button", { name: t.video.play("Juggle 20") })).toBeTruthy();
  });

  it("shows nothing for a link that is not a video", () => {
    setOnline(false);
    const { container } = render(<SkillVideo link="https://example.com/page" title="x" />);
    expect(container.innerHTML).toBe("");
  });
});
