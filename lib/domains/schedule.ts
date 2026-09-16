import { getDb } from "@/lib/db";
import { gridToSchedule, buildingsForOrder } from "@/lib/schedule";

export async function currentSchedule() {
  const sql = getDb();
  const rows = await sql<
    { version: number; lattice_order: number; grid: Buffer; score: number; ticket_hex: string; winner: string | null }[]
  >`
    SELECT s.version, s.lattice_order, s.grid, s.score, s.ticket_hex, u.nickname AS winner
    FROM physi_schedule_versions s LEFT JOIN physi_users u ON u.id = s.winner_user_id
    ORDER BY s.version DESC LIMIT 1`;
  if (!rows[0]) return { version: null as number | null, cells: [] as ReturnType<typeof gridToSchedule>, meta: null as any };
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
  };
}
