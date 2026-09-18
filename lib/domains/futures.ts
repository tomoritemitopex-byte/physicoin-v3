import { getDb } from "@/lib/db";
import { DomainError } from "./users";
import { validateSession } from "./auth";

const STAKE_AMOUNT = 0.5;
const PAYOUT_AMOUNT = 1.2;

export type Future = {
  id: string;
  event_id: string;
  staker_id: string;
  direction: string;
  stake: string;
  payout: string | null;
  status: string;
  created_at: string;
  settled_at: string | null;
};

/**
 * Stake 0.5 PHY on whether a pending event will reach 8 YES.
 * Validates session, checks balance, deducts atomically, inserts open future.
 */
export async function stake(
  event_id: string,
  staker_id: string,
  direction: string,
  token: string
): Promise<Future> {
  // Support object-style call: stake({ event_id, staker_id, direction, token })
  if (typeof event_id === "object" && event_id !== null) {
    const o = event_id as any;
    return stake(o.event_id, o.staker_id, o.direction, o.token);
  }

  const dir = String(direction || "").toLowerCase();
  if (!["yes", "no"].includes(dir)) {
    throw new DomainError("BAD_DIRECTION", "direction must be 'yes' or 'no'.", 400);
  }
  if (!event_id || !staker_id) {
    throw new DomainError("MISSING_FIELDS", "event_id and staker_id are required.", 400);
  }
  if (!token) {
    throw new DomainError("NO_TOKEN", "Wallet session required.", 401);
  }

  const { user_id } = await validateSession(token);
  if (user_id !== staker_id) {
    throw new DomainError("NOT_YOURS", "This session cannot act as that wallet.", 403);
  }

  const sql = getDb();

  // Event must exist
  const ev = await sql<{ id: string; status: string }[]>`
    SELECT id, status FROM physi_events WHERE id = ${event_id} LIMIT 1`;
  if (!ev[0]) throw new DomainError("UNKNOWN_EVENT", "Event not found.", 404);

  // Check balance atomically inside transaction
  const users = await sql<{ mining_balance: string }[]>`
    SELECT mining_balance::text AS mining_balance FROM physi_users WHERE id = ${staker_id} LIMIT 1`;
  if (!users[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  if (Number(users[0].mining_balance) < STAKE_AMOUNT) {
    throw new DomainError("INSUFFICIENT_COINS", "Not enough $PHY to stake 0.5.", 409);
  }

  // Atomic deduct + insert
  const result = await sql.begin(async (tx: any) => {
    const updated = await tx<{ mining_balance: string }[]>`
      UPDATE physi_users
      SET mining_balance = mining_balance - ${STAKE_AMOUNT}, updated_at = NOW()
      WHERE id = ${staker_id} AND mining_balance >= ${STAKE_AMOUNT}
      RETURNING mining_balance::text AS mining_balance`;
    if (!updated[0]) {
      throw new DomainError("INSUFFICIENT_COINS", "Not enough $PHY to stake 0.5.", 409);
    }
    try {
      const [row] = await tx<Future[]>`
        INSERT INTO physi_futures (event_id, staker_id, direction, stake, status)
        VALUES (${event_id}, ${staker_id}, ${dir}, ${STAKE_AMOUNT}, 'open')
        RETURNING id::text, event_id::text, staker_id::text, direction, stake::text, payout::text, status, created_at::text, settled_at::text`;
      return row;
    } catch (e: any) {
      // Table missing (pre-migration) => surface as service unavailable
      if (String(e?.message || "").includes("does not exist") || String(e?.message || "").includes("relation")) {
        throw new DomainError("NOT_READY", "Futures market not ready.", 503);
      }
      throw e;
    }
  });

  return result as Future;
}

/**
 * Settle all open futures for an event when it becomes verified (8 YES quorum).
 * Winners (direction='yes') get 1.2, losers (direction='no') get 0.
 * Uses LEAST(10000, balance + payout) cap.
 */
export async function settle(event_id: string): Promise<{ settled: number; won: number; lost: number }> {
  if (!event_id) return { settled: 0, won: 0, lost: 0 };
  const sql = getDb();
  try {
    const open = await sql<{ id: string; staker_id: string; direction: string }[]>`
      SELECT id::text, staker_id::text, direction FROM physi_futures
      WHERE event_id = ${event_id} AND status = 'open'`;
    if (open.length === 0) return { settled: 0, won: 0, lost: 0 };

    let won = 0;
    let lost = 0;

    await sql.begin(async (tx: any) => {
      // Winners: yes direction
      const winners = open.filter((r) => r.direction === "yes");
      const losers = open.filter((r) => r.direction === "no");

      if (winners.length > 0) {
        const winnerIds = winners.map((w) => w.id);
        await tx`
          UPDATE physi_futures
          SET status = 'won', payout = ${PAYOUT_AMOUNT}, settled_at = NOW()
          WHERE id IN (SELECT unnest(${winnerIds}::uuid[])) AND status = 'open'`;
        for (const w of winners) {
          await tx`
            UPDATE physi_users
            SET mining_balance = LEAST(10000, mining_balance + ${PAYOUT_AMOUNT}), updated_at = NOW()
            WHERE id = ${w.staker_id}`;
        }
        won = winners.length;
      }

      if (losers.length > 0) {
        const loserIds = losers.map((l) => l.id);
        await tx`
          UPDATE physi_futures
          SET status = 'lost', payout = 0, settled_at = NOW()
          WHERE id IN (SELECT unnest(${loserIds}::uuid[])) AND status = 'open'`;
        lost = losers.length;
      }
    });

    return { settled: open.length, won, lost };
  } catch (e: any) {
    const msg = String(e?.message || "");
    // Gracefully no-op if table doesn't exist yet or DB not configured
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("DB_NOT_CONFIGURED")) {
      return { settled: 0, won: 0, lost: 0 };
    }
    // Don't crash the vote promotion on settle failure — log and return
    console.error("[futures/settle]", msg.slice(0, 200));
    return { settled: 0, won: 0, lost: 0 };
  }
}

export async function listOpenFutures(event_id: string): Promise<Future[]> {
  if (!event_id) return [];
  const sql = getDb();
  try {
    const rows = await sql<Future[]>`
      SELECT id::text, event_id::text, staker_id::text, direction, stake::text, payout::text, status, created_at::text, settled_at::text
      FROM physi_futures
      WHERE event_id = ${event_id} AND status = 'open'
      ORDER BY created_at ASC`;
    return rows;
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("does not exist") || msg.includes("relation")) return [];
    throw e;
  }
}

export async function listFutures(event_id: string, status?: string): Promise<Future[]> {
  if (!event_id) return [];
  const sql = getDb();
  try {
    if (status && ["open", "won", "lost"].includes(status)) {
      return await sql<Future[]>`
        SELECT id::text, event_id::text, staker_id::text, direction, stake::text, payout::text, status, created_at::text, settled_at::text
        FROM physi_futures
        WHERE event_id = ${event_id} AND status = ${status}
        ORDER BY created_at ASC`;
    }
    return await sql<Future[]>`
      SELECT id::text, event_id::text, staker_id::text, direction, stake::text, payout::text, status, created_at::text, settled_at::text
      FROM physi_futures
      WHERE event_id = ${event_id}
      ORDER BY created_at ASC`;
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg.includes("does not exist") || msg.includes("relation")) return [];
    throw e;
  }
}
