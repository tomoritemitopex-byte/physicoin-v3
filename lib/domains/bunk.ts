import { getDb } from "@/lib/db";
import { DomainError } from "./users";

// Bunk Radar: anonymous "lecture didn't hold" vs "happening" reports.
// 3 no-shows on one event = alert.

export async function report(input: { event_id: string; reporter_id?: string | null; vote: string }) {
  const vote = String(input.vote || "");
  if (!["no_show", "happening"].includes(vote)) {
    throw new DomainError("BAD_VOTE", "vote must be no_show or happening.");
  }
  const sql = getDb();
  const ev = await sql`SELECT id FROM physi_events WHERE id = ${input.event_id} LIMIT 1`;
  if (!ev[0]) throw new DomainError("UNKNOWN_EVENT", "Event not found.", 404);
  if (input.reporter_id) {
    await sql`
      INSERT INTO physi_bunk_reports (event_id, reporter_id, vote)
      VALUES (${input.event_id}, ${input.reporter_id}, ${vote})
      ON CONFLICT (event_id, reporter_id) WHERE reporter_id IS NOT NULL
      DO UPDATE SET vote = EXCLUDED.vote`;
  } else {
    await sql`INSERT INTO physi_bunk_reports (event_id, vote) VALUES (${input.event_id}, ${vote})`;
  }
  return status(input.event_id);
}

export async function status(event_id: string) {
  const sql = getDb();
  const rows = await sql<{ vote: string; c: string }[]>`
    SELECT vote, count(*)::text AS c FROM physi_bunk_reports
    WHERE event_id = ${event_id} GROUP BY vote`;
  let no_show = 0;
  let happening = 0;
  for (const r of rows) {
    if (r.vote === "no_show") no_show = Number(r.c);
    else happening = Number(r.c);
  }
  return { event_id, no_show_count: no_show, happening_count: happening, alert: no_show >= 3 };
}

export async function recent(limit = 20) {
  const sql = getDb();
  return await sql`
    SELECT event_id, vote, created_at FROM physi_bunk_reports
    ORDER BY created_at DESC LIMIT ${Math.min(limit, 50)}`;
}
