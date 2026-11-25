// Edge Function: emails the admins when a leaderboard report is added (#104, plan/admin-page-plan.md).
// Called by a Database Webhook on insert into public.leaderboard_reports. Deploy with --no-verify-jwt,
// because the webhook proves itself with the shared secret in the x-webhook-secret header instead.
//
// Secrets (supabase secrets set ...): WEBHOOK_SECRET, RESEND_API_KEY, ADMIN_EMAILS (comma separated),
// EMAIL_FROM (a sender Resend allows), APP_URL (for example https://hapiskill.com). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set by Supabase. The service role key stays in this function.
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseAddresses, planFor, reportEmail, sameSecret, summaryEmail, type Email } from "./email.ts";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function send(to: string[], email: Email): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}` },
    body: JSON.stringify({ from: Deno.env.get("EMAIL_FROM"), to, subject: email.subject, text: email.text }),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}`);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret || !sameSecret(req.headers.get("x-webhook-secret") ?? "", secret)) return json(401, { error: "unauthorised" });
  if (req.method !== "POST") return json(405, { error: "post only" });

  const payload = await req.json().catch(() => null);
  const record = payload?.type === "INSERT" && payload?.table === "leaderboard_reports" ? payload.record : null;
  if (!record || typeof record.id !== "number") return json(400, { error: "not a new report" });

  const admins = parseAddresses(Deno.env.get("ADMIN_EMAILS"));
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");
  if (admins.length === 0 || !appUrl || !Deno.env.get("RESEND_API_KEY") || !Deno.env.get("EMAIL_FROM")) return json(500, { error: "not set up" });
  const adminUrl = `${appUrl}/#admin`;

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    // Reports in the last hour up to and including this one. Counted in the database, so the limit holds
    // even though the function remembers nothing between calls.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recent, error: e1 } = await db
      .from("leaderboard_reports")
      .select("id", { count: "exact", head: true })
      .gt("created_at", since)
      .lte("id", record.id);
    if (e1) throw e1;

    const plan = planFor(recent ?? 1);
    if (plan === "none") return json(200, { sent: false });
    if (plan === "summary") {
      await send(admins, summaryEmail(adminUrl));
      return json(200, { sent: "summary" });
    }

    const [{ data: profile }, { count: open }] = await Promise.all([
      db.from("profiles").select("display_name").eq("user_id", record.reported_id).maybeSingle(),
      db.from("leaderboard_reports").select("id", { count: "exact", head: true }).eq("reported_id", record.reported_id).eq("status", "open"),
    ]);
    await send(
      admins,
      reportEmail({ id: record.id, reportedName: profile?.display_name ?? "(left the board)", reason: String(record.reason ?? ""), openForPlayer: open ?? 1 }, adminUrl),
    );
    return json(200, { sent: true });
  } catch (e) {
    // A failed email never fails the report: the webhook is asynchronous and the report is already saved.
    console.error("notify-report failed:", e instanceof Error ? e.message : e);
    return json(502, { error: "email failed" });
  }
});
