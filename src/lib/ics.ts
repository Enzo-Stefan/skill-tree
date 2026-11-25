// An iCalendar (RFC 5545) file with one weekly event on the player's training days.

/** Two-letter iCalendar day codes, Monday first, matching the plan's day indexes. */
const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
const DEFAULT_START_HOUR = 17;
const DEFAULT_DURATION_MINUTES = 60;
const MAX_LINE_OCTETS = 75;

export interface TrainingCalendarInput {
  /** Training weekdays as plan indexes: 0 is Monday, 6 is Sunday. Invalid entries are ignored. */
  days: readonly number[];
  /** Event title. */
  summary: string;
  /** Event description, shown before the link. */
  description: string;
  /** Link back to the app, added to the description and to the URL property. */
  link: string;
  /** Sets DTSTAMP and the first occurrence: the first training day on or after this local date. */
  now: Date;
  /** Local start hour, 0 to 23. Defaults to 17:00. */
  startHour?: number;
  /** Length of each session in minutes. Defaults to 60. */
  durationMinutes?: number;
}

/**
 * Builds the .ics text for a weekly repeating event on the given days.
 *
 * Times are floating (no time zone), so each session starts at the same wall-clock time wherever
 * the calendar is read. Lines end with CRLF and are folded at 75 octets, as RFC 5545 requires.
 *
 * Args:
 *   input: The days, the event text, the link and the start time.
 *
 * Returns:
 *   The complete calendar file, ready to save as a .ics file.
 *
 * Raises:
 *   RangeError: If no valid training day is given, or the link is not an absolute URL.
 */
export function trainingIcs(input: TrainingCalendarInput): string {
  const weekdays = [...new Set(input.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (weekdays.length === 0) throw new RangeError("trainingIcs needs at least one training day");
  const startHour = input.startHour ?? DEFAULT_START_HOUR;
  const duration = input.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const url = new URL(input.link);

  const first = firstOccurrence(weekdays, input.now);
  const start = localStamp(first, startHour, 0);
  const end = localStamp(first, startHour, duration);
  const rrule = `FREQ=WEEKLY;BYDAY=${weekdays.map((d) => BYDAY[d]).join(",")}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Skill Tree//Training plan//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeText(`skill-tree-training:${url.host}${url.pathname}`)}`,
    `DTSTAMP:${utcStamp(input.now)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `RRULE:${rrule}`,
    `SUMMARY:${escapeText(input.summary)}`,
    `DESCRIPTION:${escapeText(`${input.description}\n${input.link}`)}`,
    `URL:${input.link}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Escapes a TEXT value: backslash, semicolon, comma and newline, per RFC 5545 section 3.3.11. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Splits a content line longer than 75 octets: continuation lines start with one space, and never split a character. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  let limit = MAX_LINE_OCTETS;
  for (const ch of line) {
    const size = utf8Octets(ch);
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
      // The space that starts a continuation line counts toward the 75 octets.
      limit = MAX_LINE_OCTETS - 1;
    }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.map((part, i) => (i === 0 ? part : ` ${part}`)).join("\r\n");
}

function utf8Octets(ch: string): number {
  const code = ch.codePointAt(0)!;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}

/** The first date on or after `now` (local time) whose weekday is one of `weekdays`. */
function firstOccurrence(weekdays: number[], now: Date): Date {
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (weekdays.includes((date.getDay() + 6) % 7)) return date;
  }
  throw new RangeError("no training day in the next week");
}

/** A floating local date-time, YYYYMMDDTHHMMSS, on `day` at `hour`:`minutes` (minutes may overflow the hour). */
function localStamp(day: Date, hour: number, minutes: number): string {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minutes);
  return `${pad(d.getFullYear(), 4)}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

/** A UTC date-time, YYYYMMDDTHHMMSSZ, as DTSTAMP needs. */
function utcStamp(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}
