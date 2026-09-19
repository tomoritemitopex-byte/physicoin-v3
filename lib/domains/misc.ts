import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { DomainError } from "./users";

// Smaller read-model domains: repeats, dedup, consensus, stats,
// presence, streaks, vote weight, calendar, alerts.

export async function repeatSchedule(user_id: string, scope_value?: string) {
  const sql = getDb();
  const src = await sql<{ c: string }[]>`
    SELECT count(*)::text AS c FROM physi_users WHERE id = ${user_id} LIMIT 1`;
  if (!src[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  const rows = await sql<{ title: string; venue: string; event_time: string; scope_type: string; scope_value: string | null }[]>`
    SELECT title, venue, event_time::text, scope_type, scope_value FROM physi_events
    WHERE created_by = ${user_id} AND event_date >= CURRENT_DATE - INTERVAL '7 days'
      AND (${scope_value || null}::text IS NULL OR scope_value = ${scope_value || null})
    LIMIT 100`;
  let created = 0;
  for (const r of rows) {
    try {
      await sql`
        INSERT INTO physi_events (title, venue, event_date, event_time, scope_type, scope_value, created_by)
        VALUES (${r.title}, ${r.venue}, CURRENT_DATE + INTERVAL '7 days', ${r.event_time},
          ${r.scope_type}, ${r.scope_value}, ${user_id})`;
      created++;
    } catch {
      // duplicate week-ahead slot — skip
    }
  }
  return { created, source_count: rows.length };
}

export async function dedupCheck(input: { title?: string; venue?: string; event_date?: string }) {
  const sql = getDb();
  if (input.title && input.venue && input.event_date) {
    const rows = await sql`
      SELECT id, title, venue, event_date, status FROM physi_events
      WHERE lower(title) = ${String(input.title).toLowerCase()}
        AND lower(venue) = ${String(input.venue).toLowerCase()}
        AND event_date = ${input.event_date}::date LIMIT 1`;
    if (rows[0]) return { duplicate: true, existing: rows[0] };
  }
  let canonicalVenue = null;
  if (input.title) {
    const rows = await sql<{ venue: string }[]>`
      SELECT venue FROM physi_events WHERE lower(title) = ${String(input.title).toLowerCase()}
      GROUP BY venue ORDER BY count(*) DESC LIMIT 1`;
    canonicalVenue = rows[0]?.venue || null;
  }
  return { duplicate: false, canonicalVenue };
}

export async function consensusFeed(limit = 50) {
  const sql = getDb();
  const halls = await sql`
    SELECT id, alias, canonical, votes_yes, votes_no FROM physi_hall_aliases
    WHERE status = 'pending' ORDER BY vote_count DESC NULLS LAST, created_at DESC
    LIMIT ${Math.min(limit, 50)}`;
  const profs = await sql`
    SELECT id, alias, canonical, votes_yes, votes_no FROM physi_prof_aliases
    WHERE status = 'pending' ORDER BY created_at DESC LIMIT ${Math.min(limit, 50)}`;
  const scopes = await sql`
    SELECT scope_a, scope_b, count(*)::int AS total,
      count(*) FILTER (WHERE vote_value = 1)::int AS yes
    FROM physi_scope_votes
    WHERE (scope_a, scope_b) NOT IN (SELECT scope_a, scope_b FROM physi_scope_resolution)
    GROUP BY scope_a, scope_b ORDER BY total DESC LIMIT ${Math.min(limit, 50)}`;
  const items = [
    ...halls.map((h: any) => ({ type: "hall", ...h })),
    ...profs.map((p: any) => ({ type: "prof", ...p })),
    ...scopes.map((s: any) => ({ type: "scope", alias: `${s.scope_a} = ${s.scope_b}`, votes_yes: s.yes, votes_no: s.total - s.yes })),
  ];
  return { items, breakdown: { hall: halls.length, prof: profs.length, scope: scopes.length } };
}

export async function stats() {
  const sql = getDb();
  // base counts + 7d window (additive: no new tables, just time-filtered counts)
  let users = 0, events = 0, verifications = 0, mined = 0;
  let users_7d = 0, events_7d = 0;
  try {
    const [u] = await sql<{ users: number; events: number; verifications: number; mined: number; users_7d: number; events_7d: number }[]>`
      SELECT (SELECT count(*)::int FROM physi_users) AS users,
        (SELECT count(*)::int FROM physi_users WHERE created_at >= NOW() - INTERVAL '7 days') AS users_7d,
        (SELECT count(*)::int FROM physi_events) AS events,
        (SELECT count(*)::int FROM physi_events WHERE created_at >= NOW() - INTERVAL '7 days') AS events_7d,
        (SELECT count(*)::int FROM physi_verifications) AS verifications,
        (SELECT count(*)::int FROM physi_mining_logs) AS mined`;
    users = Number((u as any).users ?? 0);
    events = Number((u as any).events ?? 0);
    verifications = Number((u as any).verifications ?? 0);
    mined = Number((u as any).mined ?? 0);
    users_7d = Number((u as any).users_7d ?? 0);
    events_7d = Number((u as any).events_7d ?? 0);
  } catch {
    // fallback: query totals only (older DB without 7d window)
    try {
      const [u2] = await sql<{ users: number; events: number; verifications: number; mined: number }[]>`
        SELECT (SELECT count(*)::int FROM physi_users) AS users,
          (SELECT count(*)::int FROM physi_events) AS events,
          (SELECT count(*)::int FROM physi_verifications) AS verifications,
          (SELECT count(*)::int FROM physi_mining_logs) AS mined`;
      users = Number((u2 as any).users ?? 0);
      events = Number((u2 as any).events ?? 0);
      verifications = Number((u2 as any).verifications ?? 0);
      mined = Number((u2 as any).mined ?? 0);
    } catch {}
  }
  const byStatus = await sql<{ status: string; c: number }[]>`
    SELECT status, count(*)::int AS c FROM physi_events GROUP BY status`.catch(() => [] as any);
  const events_by_status: Record<string, number> = {};
  for (const r of byStatus as any[]) events_by_status[(r as any).status] = Number((r as any).c);
  return { users, events, verifications, mined, events_by_status, users_7d, events_7d, users_new_7d: users_7d, events_new_7d: events_7d } as any;
}

export async function echoStrength(event_id: string) {
  const sql = getDb();
  const rows = await sql<{ c: string; witnesses: string }[]>`
    SELECT count(*)::text AS c, count(*) FILTER (WHERE is_witness)::text AS witnesses
    FROM physi_verifications WHERE event_id = ${event_id}`;
  const total = Number(rows[0]?.c || 0);
  return {
    event_id,
    participant_count: total,
    echo_strength: total === 0 ? 0 : Math.min(1, total / 8),
    label: total === 0 ? "silent" : total >= 8 ? "loud" : "murmur",
  };
}

export async function cohortInfo(user_id: string) {
  const sql = getDb();
  const me = await sql<{ programme: string; level: string }[]>`
    SELECT programme, level FROM physi_users WHERE id = ${user_id} LIMIT 1`;
  if (!me[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  const [r] = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM physi_users
    WHERE programme = ${me[0].programme} AND level = ${me[0].level}`;
  return { count: Number(r.count), programme: me[0].programme, level: me[0].level };
}

export async function ghostDots() {
  const sql = getDb();
  const rows = await sql<{ vid: string }[]>`
    SELECT DISTINCT verifier_id AS vid FROM physi_verifications ORDER BY vid LIMIT 200`;
  const dots = rows.slice(0, Math.max(1, Math.floor(rows.length / 10))).map((r, i) => {
    const h = createHash("sha256").update(r.vid).digest("hex");
    return {
      id: h.slice(0, 12),
      hash: h.slice(0, 8),
      yPct: parseInt(h.slice(8, 10), 16) % 100,
      delay: (parseInt(h.slice(10, 12), 16) % 20) / 10 + i * 0.05,
    };
  });
  return { dots, count: dots.length };
}

export async function streakHeatmap(user_id: string, days = 30) {
  const sql = getDb();
  const d = Math.min(Math.max(days, 7), 90);
  const rows = await sql<{ day: string }[]>`
    SELECT DISTINCT created_at::date::text AS day FROM physi_mining_logs
    WHERE user_id = ${user_id} AND created_at >= CURRENT_DATE - (${d} || ' days')::interval
    UNION
    SELECT DISTINCT v.created_at::date::text AS day FROM physi_verifications v
    JOIN physi_events e ON e.id = v.event_id
    WHERE v.verifier_id = ${user_id} AND v.created_at >= CURRENT_DATE - (${d} || ' days')::interval`;
  const set = new Set(rows.map((r) => r.day));
  const heatmap: { date: string; active: boolean }[] = [];
  const today = new Date();
  for (let i = d - 1; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    heatmap.push({ date: key, active: set.has(key) });
  }
  let streakLen = 0;
  for (let i = heatmap.length - 1; i >= 0; i--) {
    if (heatmap[i].active) streakLen++;
    else if (i === heatmap.length - 1) continue; // today may still happen
    else break;
  }
  return { heatmap, streakLen };
}

export async function voteWeightInfo(user_id: string) {
  const sql = getDb();
  const [r] = await sql<{ verifications: string; scopes: string; halls: string; profs: string }[]>`
    SELECT (SELECT count(*)::text FROM physi_verifications WHERE verifier_id = ${user_id}) AS verifications,
      (SELECT count(*)::text FROM physi_scope_votes WHERE voter_id = ${user_id}) AS scopes,
      (SELECT count(*)::text FROM physi_hall_alias_votes WHERE voter_id = ${user_id}) AS halls,
      (SELECT count(*)::text FROM physi_prof_alias_votes WHERE voter_id = ${user_id}) AS profs`;
  const total =
    Number(r.verifications) + Number(r.scopes) + Number(r.halls) + Number(r.profs);
  const weight = Math.round((1 + Math.min(1, total / 40)) * 100) / 100;
  const label = weight >= 1.75 ? "Legend" : weight >= 1.5 ? "Veteran" : weight >= 1.25 ? "Regular" : "Explorer";
  return {
    weight,
    label,
    breakdown: {
      verifications: Number(r.verifications),
      scope_votes: Number(r.scopes),
      hall_votes: Number(r.halls),
      prof_votes: Number(r.profs),
    },
  };
}

export async function upcomingAlerts(input: { programme?: string; level?: string }) {
  const sql = getDb();
  const rows = await sql<
    { id: string; title: string; venue: string; event_date: string; event_time: string; yes: string }[]
  >`
    SELECT e.id, e.title, e.venue, e.event_date::text, e.event_time::text,
      COALESCE((SELECT SUM(v.authority_weight)::text FROM physi_verifications v
        WHERE v.event_id = e.id AND v.vote = 'YES'), '0') AS yes
    FROM physi_events e
    WHERE e.status = 'pending'
      AND (e.event_date::timestamp + e.event_time) BETWEEN NOW() AND NOW() + INTERVAL '7 days'
      AND (${input.programme || null}::text IS NULL OR e.scope_value = ${input.programme || null} OR e.scope_type = 'general')
    ORDER BY e.event_date, e.event_time LIMIT 50`;
  const now = Date.now();
  return rows.map((e) => {
    const mins = Math.max(0, Math.round((new Date(`${e.event_date}T${e.event_time}`).getTime() - now) / 60000));
    const risk = mins < 120 && Number(e.yes) < 4 ? "HIGH" : mins < 720 ? "MED" : "LOW";
    return { ...e, minutes_until: mins, risk };
  });
}

export async function ghostChain(user_id: string, verify = false) {
  const sql = getDb();
  const chain = await sql<{ prev_sig: string; new_sig: string; action: string; created_at: string }[]>`
    SELECT prev_sig, new_sig, action, created_at FROM physi_ghost_chain
    WHERE user_id = ${user_id} ORDER BY created_at ASC LIMIT 200`;
  let chain_valid: boolean | null = null;
  if (verify) {
    chain_valid = true;
    let prev = "GENESIS";
    for (const link of chain) {
      if (link.prev_sig !== prev) {
        chain_valid = false;
        break;
      }
      prev = link.new_sig;
    }
  }
  return { chain, count: chain.length, chain_valid };
}

export async function calendarIcs(input: { user_id?: string; programme?: string; level?: string }) {
  const sql = getDb();
  const rows = await sql<{ title: string; venue: string; event_date: string; event_time: string }[]>`
    SELECT title, venue, event_date::text, event_time::text FROM physi_events
    WHERE status IN ('pending', 'verified')
      AND (event_date::timestamp + event_time) BETWEEN NOW() AND NOW() + INTERVAL '30 days'
      AND (${input.programme || null}::text IS NULL OR scope_value = ${input.programme || null} OR scope_type = 'general')
    ORDER BY event_date, event_time LIMIT 200`;
  const esc = (s: string) => String(s).replace(/[,;\\]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const evs = rows
    .map((e, i) => {
      const dt = `${e.event_date.replace(/-/g, "")}T${e.event_time.replace(/:/g, "").slice(0, 6)}`;
      return `BEGIN:VEVENT\r\nUID:v3-${i}-${dt}@physicoin\r\nDTSTART:${dt}\r\nSUMMARY:${esc(e.title)}\r\nLOCATION:${esc(e.venue)}\r\nEND:VEVENT`;
    })
    .join("\r\n");
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//PhysiCoin v3//Timetable//EN\r\n${evs}\r\nEND:VCALENDAR`;
}
