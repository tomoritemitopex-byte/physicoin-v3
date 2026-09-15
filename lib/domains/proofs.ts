import { createHash, createHmac } from "node:crypto";
import { getDb, dbUrl } from "@/lib/db";
import { DomainError } from "./users";

// Day-proof headers: one hash root per day over verified events,
// chained to the previous day. Simplified Merkle discipline:
// root = sha256 over sorted leaf hashes; proof = leaf + position + root.

const leaf = (id: string) => createHash("sha256").update(`leaf:${id}`).digest("hex");

export async function dayHeader(date?: string) {
  const sql = getDb();
  const day: string =
    date || ((await sql<{ d: string }[]>`SELECT CURRENT_DATE::text AS d`)[0].d as string);
  const evs = await sql<{ id: string }[]>`
    SELECT id FROM physi_events WHERE status = 'verified' AND created_at::date = ${day}::date ORDER BY id`;
  const leaves = evs.map((e) => leaf(e.id)).sort();
  const root = createHash("sha256").update(`root:${day}:${leaves.join(",")}`).digest("hex");
  const prev = await sql<{ hmac: string }[]>`
    SELECT hmac FROM physi_headers WHERE date < ${day}::date ORDER BY date DESC LIMIT 1`;
  const prevHash = prev[0]?.hmac || "GENESIS";
  const hmac = createHmac("sha256", dbUrl() || "v3")
    .update(`${day}:${prevHash}:${root}`)
    .digest("hex");
  await sql`
    INSERT INTO physi_headers (date, merkle_root, ghost_tip_root, prev_hash, hmac, count)
    VALUES (${day}::date, ${root}, ${root}, ${prevHash}, ${hmac}, ${evs.length})
    ON CONFLICT (date) DO UPDATE SET merkle_root = EXCLUDED.merkle_root,
      ghost_tip_root = EXCLUDED.ghost_tip_root, prev_hash = EXCLUDED.prev_hash,
      hmac = EXCLUDED.hmac, count = EXCLUDED.count`;
  return { date: day, prevHash, merkleRoot: root, count: evs.length, hmac, verified: true };
}

export async function eventProof(event_id: string) {
  const sql = getDb();
  const evs = await sql<{ id: string; status: string; created: string }[]>`
    SELECT id, status, created_at::date::text AS created FROM physi_events WHERE id = ${event_id} LIMIT 1`;
  if (!evs[0]) throw new DomainError("UNKNOWN_EVENT", "Event not found.", 404);
  const header = await dayHeader(evs[0].created);
  const evs2 = await sql<{ id: string }[]>`
    SELECT id FROM physi_events WHERE status = 'verified' AND created_at::date = ${evs[0].created}::date ORDER BY id`;
  const leaves = evs2.map((e) => leaf(e.id)).sort();
  const position = leaves.indexOf(leaf(event_id));
  return {
    header,
    leaf: leaf(event_id),
    branch: leaves.filter((_, i) => i !== position),
    root: header.merkleRoot,
    included: position >= 0,
    verified: evs[0].status === "verified",
  };
}
