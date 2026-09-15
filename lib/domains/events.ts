import { getDb } from "@/lib/db";
import { DomainError } from "./users";

export type Event = {
  id: string;
  title: string;
  venue: string;
  event_date: string;
  event_time: string;
  scope_type: string;
  scope_value: string | null;
  status: string;
  required_points: string;
  severity: string;
  created_by: string | null;
  created_at: string;
};

export function slotKey(title: string, venue: string, date: string): string {
  return `${title.toLowerCase().trim()}|${venue.toLowerCase().trim()}|${date}`;
}

export async function postEvent(input: {
  title: string;
  venue: string;
  event_date: string;
  event_time: string;
  scope_type: string;
  scope_value?: string | null;
  severity?: string;
  created_by?: string | null;
}): Promise<{ event: Event } | { duplicate: true; existing: Event }> {
  for (const f of ["title", "venue", "event_date", "event_time", "scope_type"] as const) {
    if (!input[f]) throw new DomainError("MISSING_FIELDS", `${f} is required.`);
  }
  const severity = input.severity || "move";
  if (!["move", "shift", "cancelled"].includes(severity)) {
    throw new DomainError("BAD_SEVERITY", "severity must be move, shift or cancelled.");
  }
  const sql = getDb();
  const key = slotKey(input.title, input.venue, input.event_date);
  try {
    const [ev] = await sql<Event[]>`
      INSERT INTO physi_events (title, venue, event_date, event_time, scope_type, scope_value, severity, slot_key, created_by)
      VALUES (${input.title}, ${input.venue}, ${input.event_date}, ${input.event_time},
        ${input.scope_type}, ${input.scope_value || null}, ${severity}, ${key}, ${input.created_by || null})
      RETURNING id, title, venue, event_date, event_time, scope_type, scope_value,
        status, required_points, severity, created_by, created_at`;
    return { event: ev };
  } catch (e) {
    if (String((e as Error)?.message || "").includes("duplicate")) {
      const rows = await sql<Event[]>`
        SELECT id, title, venue, event_date, event_time, scope_type, scope_value,
          status, required_points, severity, created_by, created_at
        FROM physi_events
        WHERE lower(title) = ${input.title.toLowerCase()}
          AND lower(venue) = ${input.venue.toLowerCase()}
          AND event_date = ${input.event_date}::date
        LIMIT 1`;
      return { duplicate: true, existing: rows[0] };
    }
    throw e;
  }
}

export async function listEvents(opts: { status?: string; limit?: number } = {}): Promise<Event[]> {
  const sql = getDb();
  const limit = Math.min(Math.max(opts.limit || 50, 1), 200);
  if (opts.status) {
    return await sql<Event[]>`
      SELECT id, title, venue, event_date, event_time, scope_type, scope_value,
        status, required_points, severity, created_by, created_at
      FROM physi_events WHERE status = ${opts.status}
      ORDER BY event_date DESC, event_time DESC LIMIT ${limit}`;
  }
  return await sql<Event[]>`
    SELECT id, title, venue, event_date, event_time, scope_type, scope_value,
      status, required_points, severity, created_by, created_at
    FROM physi_events
    ORDER BY event_date DESC, event_time DESC LIMIT ${limit}`;
}
