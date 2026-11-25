import { describe, expect, it } from "vitest";
import { escapeText, foldLine, trainingIcs, type TrainingCalendarInput } from "./ics";

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
    const text = trainingIcs(input({ startHour: 7, durationMinutes: 90 }));
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
    expect(field(a, "UID")).toBe("skill-tree-training:skill.example.app/app/");
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
