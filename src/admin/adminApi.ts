import type { SupabaseClient } from "@supabase/supabase-js";

// Calls for the admin page (#104). The database decides who is an admin: every function below is refused
// for anyone else (migration 006), so nothing here is a security check.

export interface AdminReport {
  id: number;
  reason: string;
  reportedAt: string;
  status: "open" | "dismissed" | "actioned";
  reporter: string;
}

/** One reported player with their reports. rowKey is the player's row key, never a user id. */
export interface ReportedPlayer {
  rowKey: string | null;
  displayName: string;
  countryCode: string | null;
  hidden: boolean;
  openCount: number;
  lastReportedAt: string;
  reports: AdminReport[];
}

export type ReportList = "open" | "resolved";

interface ListRow {
  row_key: string | null;
  display_name: string;
  country_code: string | null;
  hidden: boolean;
  open_count: number | string;
  last_reported_at: string;
  reports: { id: number | string; reason: string; reported_at: string; status: AdminReport["status"]; reporter: string }[] | null;
}

/** True when the signed-in player is an admin. A failed call counts as "no". */
export async function fetchIsAdmin(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc("is_admin");
  return !error && data === true;
}

export async function fetchReports(client: SupabaseClient, which: ReportList): Promise<ReportedPlayer[]> {
  const { data, error } = await client.rpc("admin_list_reports", { which });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ListRow[]).map((row) => ({
    rowKey: row.row_key,
    displayName: row.display_name,
    countryCode: row.country_code,
    hidden: row.hidden,
    openCount: Number(row.open_count),
    lastReportedAt: row.last_reported_at,
    reports: (row.reports ?? []).map((r) => ({ id: Number(r.id), reason: r.reason, reportedAt: r.reported_at, status: r.status, reporter: r.reporter })),
  }));
}

/** dismiss closes one report. hide takes the reported player off the board and closes all their open reports. */
export async function resolveReport(client: SupabaseClient, reportId: number, action: "dismiss" | "hide"): Promise<void> {
  const { error } = await client.rpc("admin_resolve_report", { report_id: reportId, action });
  if (error) throw new Error(error.message);
}

export async function unhidePlayer(client: SupabaseClient, rowKey: string): Promise<void> {
  const { error } = await client.rpc("admin_unhide", { row_key: rowKey });
  if (error) throw new Error(error.message);
}
