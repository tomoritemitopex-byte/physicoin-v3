import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { DomainError } from "./users";

// Squad: ephemeral location pings (12 min) + waves (5 min).
// Everything public is anonymous dots — user ids never leave the server.

const anon = (id: string) => createHash("sha256").update(id).digest("hex").slice(0, 12);

export async function ping(input: {
  user_id: string;
  programme?: string;
  level?: string;
  building_id?: string;
  lat?: number | null;
  lng?: number | null;
}) {
  if (!input.user_id) throw new DomainError("MISSING_FIELDS", "user_id is required.");
  const sql = getDb();
  const u = await sql`SELECT id FROM physi_users WHERE id = ${input.user_id} LIMIT 1`;
  if (!u[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  await sql`DELETE FROM physi_squad_pings WHERE user_id = ${input.user_id}`;
  const [p] = await sql`
    INSERT INTO physi_squad_pings (user_id, programme, level, building_id, lat, lng)
    VALUES (${input.user_id}, ${input.programme || "PHYS"}, ${input.level || "100L"},
      ${input.building_id || "phys"}, ${input.lat ?? null}, ${input.lng ?? null})
    RETURNING id, building_id, expires_at`;
  return p;
}

export async function heat(input: { programme?: string; level?: string; viewer_id?: string }) {
  const sql = getDb();
  const rows = await sql<{ building_id: string; user_id: string }[]>`
    SELECT building_id, user_id FROM physi_squad_pings
    WHERE expires_at > NOW()
      AND (${input.programme || null}::text IS NULL OR programme = ${input.programme || null})
      AND (${input.level || null}::text IS NULL OR level = ${input.level || null})
    LIMIT 500`;
  const byBuilding: Record<string, number> = {};
  const dots = rows.map((r) => {
    byBuilding[r.building_id] = (byBuilding[r.building_id] || 0) + 1;
    return {
      anon_seed: anon(r.user_id),
      building_id: r.building_id,
      is_me: !!input.viewer_id && r.user_id === input.viewer_id,
    };
  });
  return { heat: byBuilding, dots, count: rows.length };
}

export async function wave(input: { from_user: string; to_user: string; message?: string }) {
  if (!input.from_user || !input.to_user) throw new DomainError("MISSING_FIELDS", "from_user and to_user are required.");
  if (input.from_user === input.to_user) throw new DomainError("BAD_WAVE", "Cannot wave at yourself.");
  const sql = getDb();
  const [w] = await sql`
    INSERT INTO physi_squad_waves (from_user, to_user, message)
    VALUES (${input.from_user}, ${input.to_user}, ${String(input.message || "wave").slice(0, 140)})
    RETURNING id, message, expires_at`;
  return w;
}

export async function inbox(user_id: string) {
  const sql = getDb();
  return await sql`
    SELECT id, message, created_at, expires_at FROM physi_squad_waves
    WHERE to_user = ${user_id} AND expires_at > NOW() ORDER BY created_at DESC LIMIT 20`;
}
