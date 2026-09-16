import { getDb } from "@/lib/db";
import { DomainError } from "./users";
import { validateSession } from "./auth";

// Peer direct messages. Privacy rule: the reader must present the
// session of a wallet IN the conversation; the sender must present
// the sender's own session. There is no global feed and no admin view.

export async function thread(user_id: string, peer_id: string, token: string) {
  const { user_id: me } = await validateSession(token);
  if (me !== user_id) throw new DomainError("NOT_YOURS", "This session cannot read that inbox.", 403);
  if (!peer_id || peer_id === user_id) throw new DomainError("BAD_PEER", "A conversation needs someone else.");
  const sql = getDb();
  // UUIDs compare as UUIDs only (same guard as sendDM).
  const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(peer_id);
  const peer = looksUuid
    ? await sql`SELECT id FROM physi_users WHERE id = ${peer_id} LIMIT 1`
    : await sql`SELECT id FROM physi_users WHERE lower(nickname) = ${peer_id.toLowerCase()} LIMIT 1`;
  if (!peer[0]) throw new DomainError("UNKNOWN_PEER", "Wallet not found.", 404);
  const peerId = peer[0].id as string;
  await sql`UPDATE physi_direct_messages SET read_at = NOW()
    WHERE to_user = ${user_id} AND from_user = ${peerId} AND read_at IS NULL`;
  return await sql`
    SELECT id, from_user, to_user, body, created_at,
      (read_at IS NOT NULL) AS is_read
    FROM physi_direct_messages
    WHERE (from_user = ${user_id} AND to_user = ${peerId})
       OR (from_user = ${peerId} AND to_user = ${user_id})
    ORDER BY created_at ASC LIMIT 100`;
}

export async function sendDM(input: { from_user_id: string; to: string; body: string; token: string }) {
  const { user_id: me } = await validateSession(input.token);
  if (me !== input.from_user_id) {
    throw new DomainError("NOT_YOUR_WALLET", "This session cannot send from that wallet.", 403);
  }
  const body = String(input.body || "").trim().slice(0, 500);
  if (!body) throw new DomainError("EMPTY_MESSAGE", "Write something first.");
  const sql = getDb();
  // `to` accepts a nickname or a wallet id — only compare UUIDs as UUIDs.
  const looksUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.to);
  const peer = looksUuid
    ? await sql<{ id: string }[]>`SELECT id FROM physi_users WHERE id = ${input.to} LIMIT 1`
    : await sql<{ id: string }[]>`
        SELECT id FROM physi_users WHERE lower(nickname) = ${String(input.to).toLowerCase()} LIMIT 1`;
  if (!peer[0]) throw new DomainError("UNKNOWN_PEER", "Wallet not found.", 404);
  if (peer[0].id === input.from_user_id) throw new DomainError("BAD_PEER", "Talking to yourself helps no one.");
  const [m] = await sql`
    INSERT INTO physi_direct_messages (from_user, to_user, body)
    VALUES (${input.from_user_id}, ${peer[0].id}, ${body})
    RETURNING id, created_at`;
  return m;
}

export async function unreadCount(user_id: string, token: string): Promise<number> {
  const { user_id: me } = await validateSession(token);
  if (me !== user_id) throw new DomainError("NOT_YOURS", "This session cannot read that inbox.", 403);
  const sql = getDb();
  const rows = await sql<{ c: string }[]>`
    SELECT count(*)::text AS c FROM physi_direct_messages
    WHERE to_user = ${user_id} AND read_at IS NULL`;
  return Number(rows[0]?.c || 0);
}
