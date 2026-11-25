// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveTextFile } from "./saveFile";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("saveTextFile", () => {
  it("clicks a temporary download link with the file name, removes it, and frees the URL a second later", () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:fake");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const seen: { download: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      seen.push({ download: this.download, href: this.href });
    });
    saveTextFile("hello", "plan.ics", "text/calendar");
    expect(create).toHaveBeenCalledOnce();
    expect(seen).toEqual([{ download: "plan.ics", href: "blob:fake" }]);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith("blob:fake");
  });
});
