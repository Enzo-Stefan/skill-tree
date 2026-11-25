import { describe, expect, it } from "vitest";
import { EMAILS_PER_HOUR, oneLine, parseAddresses, planFor, reportEmail, sameSecret, summaryEmail } from "../functions/notify-report/email";

describe("planFor", () => {
  it("sends full emails up to the hourly limit, one summary, then nothing", () => {
    expect(planFor(1)).toBe("full");
    expect(planFor(EMAILS_PER_HOUR)).toBe("full");
    expect(planFor(EMAILS_PER_HOUR + 1)).toBe("summary");
    expect(planFor(EMAILS_PER_HOUR + 2)).toBe("none");
    expect(planFor(500)).toBe("none");
  });
});

describe("reportEmail", () => {
  const admin = "https://example.test/#admin";

  it("has the id, player, reason, count and admin link, and no reporter", () => {
    const e = reportEmail({ id: 7, reportedName: "Target", reason: "rude name", openForPlayer: 3 }, admin);
    expect(e.subject).toBe("New leaderboard report: Target");
    expect(e.text).toContain("Report #7");
    expect(e.text).toContain("Reason: rude name");
    expect(e.text).toContain("Open reports for this player: 3");
    expect(e.text).toContain(admin);
    expect(e.text.toLowerCase()).not.toContain("reporter");
  });

  it("keeps a player-written name or reason on one line, so it can't add a header or a fake line", () => {
    const e = reportEmail({ id: 1, reportedName: "Bad\r\nBcc: x@y.z", reason: "line1\nReport #99\u2028more", openForPlayer: 1 }, admin);
    expect(e.subject).not.toMatch(/[\r\n]/);
    expect(e.text.split("\n").filter((l) => l.startsWith("Report #"))).toEqual(["Report #1"]);
  });

  it("is plain text: markup in the reason is not turned into anything", () => {
    const e = reportEmail({ id: 1, reportedName: "X", reason: "<script>alert(1)</script>", openForPlayer: 1 }, admin);
    expect(e.text).toContain("<script>alert(1)</script>");
    expect(Object.keys(e).sort()).toEqual(["subject", "text"]);
  });
});

describe("summaryEmail", () => {
  it("says why the emails stopped and links to the admin page", () => {
    const e = summaryEmail("https://example.test/#admin");
    expect(e.text).toContain(`More than ${EMAILS_PER_HOUR} reports`);
    expect(e.text).toContain("https://example.test/#admin");
  });
});

describe("helpers", () => {
  it("oneLine collapses whitespace and cuts to the limit", () => {
    expect(oneLine("  a \t b\n\nc  ")).toBe("a b c");
    expect(oneLine("x".repeat(100), 10)).toHaveLength(10);
  });

  it("sameSecret compares exactly", () => {
    expect(sameSecret("abc", "abc")).toBe(true);
    expect(sameSecret("abc", "abd")).toBe(false);
    expect(sameSecret("abc", "abcd")).toBe(false);
    expect(sameSecret("", "abc")).toBe(false);
  });

  it("parseAddresses keeps valid addresses and drops the rest", () => {
    expect(parseAddresses(" a@b.co, bad, c@d.org ,<e@f.g>,")).toEqual(["a@b.co", "c@d.org"]);
    expect(parseAddresses(undefined)).toEqual([]);
  });
});
