// The parts of notify-report that need no Deno or network, so the tests can run them (#104).

/** At most this many report emails an hour; the next report gets one summary and the rest none. */
export const EMAILS_PER_HOUR = 10;

export type Plan = "full" | "summary" | "none";

/** What to send for a report, given how many reports (this one included) arrived in the last hour. */
export function planFor(reportsInLastHour: number): Plan {
  if (reportsInLastHour <= EMAILS_PER_HOUR) return "full";
  if (reportsInLastHour === EMAILS_PER_HOUR + 1) return "summary";
  return "none";
}

/** One line, no control characters, so player-written text can't add a header or a line to the email. */
export function oneLine(text: string, max = 80): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export interface ReportInfo {
  id: number;
  reportedName: string;
  reason: string;
  openForPlayer: number;
}

export interface Email {
  subject: string;
  text: string;
}

/** Plain text only: the reason is player-written. No reporter name and no user id. */
export function reportEmail(info: ReportInfo, adminUrl: string): Email {
  return {
    subject: `New leaderboard report: ${oneLine(info.reportedName, 30)}`,
    text: [
      `Report #${info.id}`,
      `Reported player: ${oneLine(info.reportedName, 30)}`,
      `Reason: ${oneLine(info.reason, 300)}`,
      `Open reports for this player: ${info.openForPlayer}`,
      "",
      `Open the admin page: ${adminUrl}`,
    ].join("\n"),
  };
}

export function summaryEmail(adminUrl: string): Email {
  return {
    subject: "Many new leaderboard reports",
    text: [
      `More than ${EMAILS_PER_HOUR} reports arrived in the last hour, so no more emails will be sent until it calms down.`,
      "",
      `See them all on the admin page: ${adminUrl}`,
    ].join("\n"),
  };
}

/** Compares two secrets without stopping at the first different character. */
export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** The comma-separated ADMIN_EMAILS secret as a clean list. */
export function parseAddresses(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(s));
}
