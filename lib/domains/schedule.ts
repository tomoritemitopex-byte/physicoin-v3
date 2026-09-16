import { getDb } from "@/lib/db";
import { gridToSchedule, buildingsForOrder } from "@/lib/schedule";

export type PendingSwap = {
  id: string;
  venue: string;
  period: string;
  from_venue: string | null;
  from_period: string | null;
  proposer_id: string | null;
  note: string | null;
  status: string;
  created_at: string;
  consumed_round: number | null;
};

export async function pendingSwaps(limit = 20): Promise<PendingSwap[]> {
  const sql = getDb();
  try {
    return (await sql<PendingSwap[]>`SELECT id::text, venue, period, from_venue, from_period, proposer_id::text, note, status, created_at::text, consumed_round FROM physi_pending_swaps WHERE status='pending' ORDER BY created_at ASC LIMIT ${Math.min(limit, 50)}`) as PendingSwap[];
  } catch {
    return [];
  }
}

export async function queueSwapHint(input: {
  venue: string;
  period: string;
  from_venue?: string | null;
  from_period?: string | null;
  proposer_id?: string | null;
  note?: string | null;
}): Promise<PendingSwap> {
  const sql = getDb();
  const venue = String(input.venue).trim().slice(0, 80);
  const period = String(input.period).trim().slice(0, 20);
  if (!venue || !period) throw new Error("MISSING_FIELDS");
  const [row] = await sql<PendingSwap[]>`
    INSERT INTO physi_pending_swaps (venue, period, from_venue, from_period, proposer_id, note)
    VALUES (${venue}, ${period}, ${input.from_venue || null}, ${input.from_period || null}, ${input.proposer_id || null}, ${input.note || null})
    RETURNING id::text, venue, period, from_venue, from_period, proposer_id::text, note, status, created_at::text, consumed_round`;
  return row;
}

export async function consumePendingSwaps(round: number, limit = 12): Promise<PendingSwap[]> {
  const sql = getDb();
  try {
    const pending = await sql<PendingSwap[]>`SELECT id::text, venue, period FROM physi_pending_swaps WHERE status='pending' ORDER BY created_at ASC LIMIT ${Math.min(limit, 50)}`;
    if (pending.length === 0) return [];
    const ids = pending.map((p) => p.id);
    await sql`UPDATE physi_pending_swaps SET status='consumed', consumed_at=NOW(), consumed_round=${round} WHERE id IN (SELECT unnest(${ids}::uuid[]))`;
    return pending;
  } catch {
    return [];
  }
}

export async function currentSchedule() {
  const sql = getDb();
  const rows = await sql<
    { version: number; lattice_order: number; grid: Buffer; score: number; ticket_hex: string; winner: string | null }[]
  >`
    SELECT s.version, s.lattice_order, s.grid, s.score, s.ticket_hex, u.nickname AS winner
    FROM physi_schedule_versions s LEFT JOIN physi_users u ON u.id = s.winner_user_id
    ORDER BY s.version DESC LIMIT 1`;
  let pending: PendingSwap[] = [];
  try {
    pending = await pendingSwaps(20);
  } catch {}
  if (!rows[0]) return { version: null as number | null, cells: [] as ReturnType<typeof gridToSchedule>, meta: null as any, pending_swaps: pending, pending_count: pending.length };
  const hex = rows[0].grid.toString("hex").slice(0, 2 * rows[0].lattice_order * rows[0].lattice_order);
  // Nibble store: each byte holds one cell? No — we store nibble hex as bytes.
  // For order 6, 36 bytes hold 36 nibbles + reg. Recover hex via toString('hex') would double.
  // Instead re-encode: grid bytes ARE the nibble bytes (0..5), so hex is just concatenation.
  let gridHex = "";
  for (let i = 0; i < rows[0].grid.length; i++) gridHex += rows[0].grid[i].toString(16);
  return {
    version: rows[0].version,
    lattice_order: rows[0].lattice_order,
    score: rows[0].score,
    ticket: rows[0].ticket_hex,
    winner: rows[0].winner,
    cells: gridToSchedule(gridHex, rows[0].lattice_order),
    meta: { buildings: buildingsForOrder(rows[0].lattice_order).map((b) => b.code) },
    pending_swaps: pending,
    pending_count: pending.length,
  };
}
