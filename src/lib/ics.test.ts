import { afterEach, describe, expect, it, vi } from "vitest";
import { PRODUCTION_URL, calendarLink, escapeText, foldLine, trainingIcs, type TrainingCalendarInput } from "./ics";
import { saveTextFile } from "./saveFile";

const LINK = "https://skill.example.app/app/";
// 2026-11-25 is a Wednesday (plan index 2).
const WEDNESDAY_9AM = new Date(2026, 10, 25, 9, 0, 0);

const input = (overrides: Partial<TrainingCalendarInput> = {}): TrainingCalendarInput => ({
  days: [0, 2, 4],
  summary: "Training",
  description: "Your training days.",
  link: LINK,
  now: WEDNESDAY_9AM,
  ...overrides,
});

/** The calendar's lines with folding undone, so long values can be compared whole. */
function unfold(text: string): string[] {
  return text.replace(/\r\n[ ]/g, "").split("\r\n");
}

function field(text: string, name: string): string {
  const line = unfold(text).find((l) => l.startsWith(`${name}:`));
  if (line === undefined) throw new Error(`no ${name} line`);
  return line.slice(name.length + 1);
}

describe("trainingIcs", () => {
  it("writes a calendar with one weekly event on the chosen days", () => {
    const text = trainingIcs(input());
    expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(field(text, "RRULE")).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(unfold(text).filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
  });

  it("uses CRLF for every line break and no bare LF or CR", () => {
    const text = trainingIcs(input({ description: "one\ntwo", summary: "a".repeat(200) }));
    expect(text.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("starts on the first training day on or after today, at 17:00 for an hour, floating", () => {
    // Wednesday is a training day, so the series starts today.
    const today = trainingIcs(input());
    expect(field(today, "DTSTART")).toBe("20261125T170000");
    expect(field(today, "DTEND")).toBe("20261125T180000");
    // Only Monday and Friday: from Wednesday, the next one is Friday.
    const friday = trainingIcs(input({ days: [0, 4] }));
    expect(field(friday, "DTSTART")).toBe("20261127T170000");
    expect(field(friday, "DTEND")).toBe("20261127T180000");
  });

  it("wraps to the next week when no training day is left this week", () => {
    // Saturday 2026-11-28 and Sunday 2026-11-29 are rest days; the next training day is Monday 30th.
    const saturday = trainingIcs(input({ days: [0, 2], now: new Date(2026, 10, 28, 12, 0) }));
    expect(field(saturday, "DTSTART")).toBe("20261130T170000");
  });

  it("uses the given start time and length", () => {
    const text = trainingIcs(input({ startHour: 7, durationMinutes: 90, now: new Date(2026, 10, 25, 6, 0) }));
    expect(field(text, "DTSTART")).toBe("20261125T070000");
    expect(field(text, "DTEND")).toBe("20261125T083000");
  });

  it("stamps DTSTAMP in UTC", () => {
    const text = trainingIcs(input({ now: new Date(Date.UTC(2026, 10, 25, 8, 5, 9)) }));
    expect(field(text, "DTSTAMP")).toBe("20261125T080509Z");
  });

  it("gives the same UID whatever the days or the date", () => {
    const a = trainingIcs(input({ days: [0] }));
    const b = trainingIcs(input({ days: [1, 3], now: new Date(2027, 0, 4) }));
    expect(field(a, "UID")).toBe("hapi-skill-training:skill.example.app/app/");
    expect(field(b, "UID")).toBe(field(a, "UID"));
  });

  it("puts the link in the description and the URL property", () => {
    const text = trainingIcs(input({ description: "Open it" }));
    expect(field(text, "DESCRIPTION")).toBe(`Open it\\n${LINK}`);
    expect(field(text, "URL")).toBe(LINK);
  });

  it("ignores invalid day indexes and duplicates, and orders the days Monday first", () => {
    const text = trainingIcs(input({ days: [6, 4, 4, 9, -1, 1.5, 0] }));
    expect(field(text, "RRULE")).toBe("FREQ=WEEKLY;BYDAY=MO,FR,SU");
  });

  it("refuses an empty list of training days", () => {
    expect(() => trainingIcs(input({ days: [] }))).toThrow(RangeError);
    expect(() => trainingIcs(input({ days: [7, -1] }))).toThrow(RangeError);
  });

  it("starts next week when today's session has already begun", () => {
    // Only Wednesday, exported on Wednesday 18:30: the next Wednesday is 2026-12-02.
    const late = trainingIcs(input({ days: [2], now: new Date(2026, 10, 25, 18, 30) }));
    expect(field(late, "DTSTART")).toBe("20261202T170000");
    // Wednesday and Friday: the next valid day is Friday, this week.
    const friday = trainingIcs(input({ days: [2, 4], now: new Date(2026, 10, 25, 17, 0) }));
    expect(field(friday, "DTSTART")).toBe("20261127T170000");
    // Before the start, today still counts.
    const early = trainingIcs(input({ days: [2], now: new Date(2026, 10, 25, 16, 59) }));
    expect(field(early, "DTSTART")).toBe("20261125T170000");
  });

  it("adds a display reminder 30 minutes before, with escaped text", () => {
    const text = trainingIcs(input({ summary: "Legs, arms; core" }));
    const lines = unfold(text);
    const i = lines.indexOf("BEGIN:VALARM");
    expect(lines.slice(i, i + 5)).toEqual(["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Legs\\, arms\\; core", "TRIGGER:-PT30M", "END:VALARM"]);
    expect(lines.indexOf("END:VEVENT")).toBeGreaterThan(i);
    expect(unfold(trainingIcs(input({ reminderMinutes: 10 }))).includes("TRIGGER:-PT10M")).toBe(true);
  });

  it("identifies the product as hapi skill", () => {
    expect(field(trainingIcs(input()), "PRODID")).toBe("-//hapi skill//Training plan//EN");
  });

  it("throws RangeError for a start hour, length or reminder out of range", () => {
    for (const startHour of [-1, 24, 1.5, Number.NaN]) expect(() => trainingIcs(input({ startHour }))).toThrow(RangeError);
    for (const durationMinutes of [0, -30, 1441, 2.5]) expect(() => trainingIcs(input({ durationMinutes }))).toThrow(RangeError);
    for (const reminderMinutes of [-1, 10081, 0.5]) expect(() => trainingIcs(input({ reminderMinutes }))).toThrow(RangeError);
    expect(() => trainingIcs(input({ startHour: 0, durationMinutes: 1440 }))).not.toThrow();
    expect(() => trainingIcs(input({ startHour: 23 }))).not.toThrow();
  });

  it("escapes commas, semicolons and backslashes in the summary", () => {
    const text = trainingIcs(input({ summary: "Legs, arms; core \\ rest" }));
    expect(field(text, "SUMMARY")).toBe("Legs\\, arms\\; core \\\\ rest");
  });
});

describe("escapeText", () => {
  it("escapes the RFC 5545 specials and newlines", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    expect(escapeText("x\r\ny")).toBe("x\\ny");
  });

  it("escapes a comma inside a sentence", () => {
    expect(escapeText("Training, in hapi skill")).toBe("Training\\, in hapi skill");
  });

  it("leaves text without special characters unchanged", () => {
    expect(escapeText("plain")).toBe("plain");
  });
});

describe("foldLine", () => {
  it("leaves lines of 75 octets or fewer alone", () => {
    const line = "x".repeat(75);
    expect(foldLine(line)).toBe(line);
  });

  it("folds a long ASCII line at 75 octets, with continuation lines of up to 75 including the space", () => {
    const line = `DESCRIPTION:${"abcdefghij".repeat(20)}`;
    const folded = foldLine(line);
    const physical = folded.split("\r\n");
    expect(physical.length).toBeGreaterThan(1);
    for (const part of physical) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    for (const part of physical.slice(1)) expect(part.startsWith(" ")).toBe(true);
    expect(physical.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
  });

  it("never splits a multi-byte character, and counts its octets", () => {
    const line = `SUMMARY:${"ñé€😀".repeat(30)}`;
    const folded = foldLine(line);
    const physical = folded.split("\r\n");
    for (const part of physical) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(physical.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
  });

  it("folds a long line in a generated calendar so every physical line fits", () => {
    const text = trainingIcs(input({ description: "Keep going, every week. ".repeat(10) }));
    for (const part of text.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(field(text, "DESCRIPTION")).toBe(`${"Keep going\\, every week. ".repeat(10)}\\n${LINK}`);
  });
});

describe("calendarLink", () => {
  const at = (origin: string, pathname = "/") => calendarLink({ origin, pathname, hostname: new URL(origin).hostname });

  it("uses the production URL on localhost, private-network and preview hosts", () => {
    for (const origin of ["http://localhost:5173", "http://127.0.0.1:4173", "http://[::1]:5173", "http://192.168.1.20:5173", "http://10.0.0.4", "http://172.20.1.1", "http://mac.local:5173", "https://skill-tree-git-calendar-ics-team.vercel.app"]) {
      expect(at(origin, "/app/")).toBe(PRODUCTION_URL);
    }
  });

  it("keeps the real origin and path on the production host", () => {
    expect(at("https://skill-tree-5y8k.vercel.app", "/app/")).toBe("https://skill-tree-5y8k.vercel.app/app/");
    expect(at("https://hapiskill.example", "/")).toBe("https://hapiskill.example/");
  });
});

describe("saveTextFile", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("downloads the text through a temporary link, then cleans up", () => {
    vi.useFakeTimers();
    const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    const append = vi.fn();
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("document", { createElement: vi.fn(() => link), body: { append } });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    saveTextFile("BEGIN:VCALENDAR", "training.ics", "text/calendar;charset=utf-8");

    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe("text/calendar;charset=utf-8");
    expect(link.href).toBe("blob:test");
    expect(link.download).toBe("training.ics");
    expect(append).toHaveBeenCalledWith(link);
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test");
  });
});
