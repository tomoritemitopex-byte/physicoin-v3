import { getDb } from "@/lib/db";
import { DomainError } from "./users";

export type Pod = {
  id: string;
  event_id: string;
  created_at: string;
  expires_at: string;
  member_count?: number;
  member_ids?: string[];
};

export type PodWithMembers = Pod & {
  members: string[];
};

/**
 * Ghost Pods — ephemeral 24h anonymous squads.
 * Called once when an event is promoted to verified (8-weight quorum).
 * Creates a pod containing up to 7 YES verifiers of that event.
 * Idempotent: if a pod already exists for event_id, returns it.
 * Offline-first: client mirrors active pods in localStorage (phy_pods_cache),
 * but backend via getPods() is source of truth.
 */
export async function createPodForEvent(event_id: string): Promise<PodWithMembers | null> {
  if (!event_id) throw new DomainError("MISSING_FIELDS", "event_id is required.", 400);
  const sql = getDb();
  try {
    // Idempotency: one pod per verified event
    const existing = await sql<{ id: string; event_id: string; created_at: string; expires_at: string }[]>`
      SELECT id::text, event_id::text, created_at::text, expires_at::text
      FROM physi_pods WHERE event_id = ${event_id} LIMIT 1`;
    if (existing[0]) {
      const members = await sql<{ user_id: string }[]>`
        SELECT user_id::text FROM physi_pod_members WHERE pod_id = ${existing[0].id} ORDER BY joined_at ASC`;
      return {
        id: existing[0].id,
        event_id: existing[0].event_id,
        created_at: existing[0].created_at,
        expires_at: existing[0].expires_at,
        member_count: members.length,
        member_ids: members.map((m) => m.user_id),
        members: members.map((m) => m.user_id),
      };
    }

    // Collect up to 7 YES verifiers for this event (anonymity preserved client-side)
    const verifiers = await sql<{ verifier_id: string }[]>`
      SELECT verifier_id::text FROM physi_verifications
      WHERE event_id = ${event_id} AND vote = 'YES'
      ORDER BY created_at ASC LIMIT 7`;

    if (verifiers.length === 0) return null;

    const ids = verifiers.map((v) => v.verifier_id);

    // Atomic: create pod + members
    const pod = await sql.begin(async (tx: any) => {
      const [p] = await tx<{ id: string; event_id: string; created_at: string; expires_at: string }[]>`
        INSERT INTO physi_pods (event_id, expires_at)
        VALUES (${event_id}, NOW() + INTERVAL '24 hours')
        RETURNING id::text, event_id::text, created_at::text, expires_at::text`;
      for (const uid of ids) {
        await tx`INSERT INTO physi_pod_members (pod_id, user_id) VALUES (${p.id}::uuid, ${uid}::uuid) ON CONFLICT DO NOTHING`;
      }
      return p;
    });

    return {
      id: pod.id,
      event_id: pod.event_id,
      created_at: pod.created_at,
      expires_at: pod.expires_at,
      member_count: ids.length,
      member_ids: ids,
      members: ids,
    };
  } catch (e: any) {
    const msg = String(e?.message || "");
    // Table not yet migrated or DB not configured — degrade gracefully (build without DB)
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("DB_NOT_CONFIGURED")) {
      if (msg.includes("DB_NOT_CONFIGURED")) throw e;
      // Missing table → behave as no-op until migration 014 applied
      if (msg.includes("physi_pods") || msg.includes("physi_pod_members")) return null;
      return null;
    }
    // Unique violation: race created pod — fetch and return
    if (msg.includes("duplicate") || msg.includes("already exists") || msg.includes("physi_pods_event_uidx")) {
      try {
        const existing = await sql<{ id: string; event_id: string; created_at: string; expires_at: string }[]>`
          SELECT id::text, event_id::text, created_at::text, expires_at::text FROM physi_pods WHERE event_id = ${event_id} LIMIT 1`;
        if (existing[0]) {
          const members = await sql<{ user_id: string }[]>`
            SELECT user_id::text FROM physi_pod_members WHERE pod_id = ${existing[0].id} ORDER BY joined_at ASC`;
          return {
            id: existing[0].id,
            event_id: existing[0].event_id,
            created_at: existing[0].created_at,
            expires_at: existing[0].expires_at,
            member_count: members.length,
            member_ids: members.map((m) => m.user_id),
            members: members.map((m) => m.user_id),
          };
        }
      } catch {}
    }
    console.error("[pods/createPodForEvent]", msg.slice(0, 200));
    return null;
  }
}

/**
 * List active (unexpired) pods for a user. Backend is source; client should
 * cache result in localStorage under `phy_pods_cache` for offline-first display.
 */
export async function getPods(user_id: string): Promise<Pod[]> {
  if (!user_id) throw new DomainError("MISSING_FIELDS", "user_id is required.", 400);
  const sql = getDb();
  try {
    const rows = await sql<Pod[]>`
      SELECT p.id::text AS id, p.event_id::text AS event_id, p.created_at::text, p.expires_at::text,
             (SELECT count(*)::int FROM physi_pod_members pm2 WHERE pm2.pod_id = p.id) AS member_count
      FROM physi_pods p
      JOIN physi_pod_members pm ON pm.pod_id = p.id
      WHERE pm.user_id = ${user_id}::uuid AND p.expires_at > NOW()
      ORDER BY p.expires_at ASC`;
    return rows;
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("does not exist") || msg.includes("relation")) return [];
    throw e;
  }
}

/**
 * Detailed pod view with member ids (server-side only; client renders anonymous dots).
 */
export async function getPod(pod_id: string): Promise<PodWithMembers | null> {
  if (!pod_id) return null;
  const sql = getDb();
  try {
    const rows = await sql<{ id: string; event_id: string; created_at: string; expires_at: string }[]>`
      SELECT id::text, event_id::text, created_at::text, expires_at::text FROM physi_pods WHERE id = ${pod_id}::uuid LIMIT 1`;
    if (!rows[0]) return null;
    if (new Date(rows[0].expires_at) <= new Date()) return null;
    const members = await sql<{ user_id: string }[]>`
      SELECT user_id::text FROM physi_pod_members WHERE pod_id = ${pod_id}::uuid ORDER BY joined_at ASC`;
    return {
      id: rows[0].id,
      event_id: rows[0].event_id,
      created_at: rows[0].created_at,
      expires_at: rows[0].expires_at,
      member_count: members.length,
      member_ids: members.map((m) => m.user_id),
      members: members.map((m) => m.user_id),
    };
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("does not exist") || msg.includes("relation")) return null;
    throw e;
  }
}

/**
 * Award +0.3 rep to each pod member who co-verified an event.
 * Called when verifying an event: if all active pod members voted YES on the same
 * next event, credit each member. Additive stub — real award goes via mining_balance.
 * Kept here for offline-first roadmap; not yet wired to avoid circular imports.
 */
export async function awardPodBonus(pod_id: string, event_id: string): Promise<number> {
  if (!pod_id || !event_id) return 0;
  const sql = getDb();
  try {
    const members = await sql<{ user_id: string }[]>`
      SELECT user_id::text FROM physi_pod_members WHERE pod_id = ${pod_id}::uuid`;
    if (members.length === 0) return 0;
    const ids = members.map((m) => m.user_id);
    const yesVoters = await sql<{ verifier_id: string }[]>`
      SELECT verifier_id::text FROM physi_verifications
      WHERE event_id = ${event_id}::uuid AND vote = 'YES' AND verifier_id IN (SELECT unnest(${ids}::uuid[]))`;
    // Bonus only if the whole pod co-verified the next slip
    if (yesVoters.length !== members.length) return 0;
    for (const uid of ids) {
      await sql`UPDATE physi_users SET mining_balance = LEAST(10000, mining_balance + 0.3), updated_at = NOW() WHERE id = ${uid}::uuid`;
    }
    return ids.length;
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("does not exist") || msg.includes("relation")) return 0;
    console.error("[pods/awardPodBonus]", msg.slice(0, 200));
    return 0;
  }
}
