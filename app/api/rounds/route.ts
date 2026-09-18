import { NextResponse } from "next/server";
import { recentRounds, leaderboard } from "@/lib/domains/rounds";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const limit = Number(u.searchParams.get("limit")) || 20;
    const round = u.searchParams.get("round");
    if (round && !isNaN(Number(round))) {
      const n = Number(round);
      const sql = (await import("@/lib/db")).getDb();
      const [r] = await sql`SELECT number, status, winning_score, winning_ticket, prev_hash, tx_root, tx_count, lattice_order, difficulty FROM physi_rounds WHERE number = ${n} LIMIT 1`;
      if (!r) return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 404 });
      const txs = await sql`SELECT e.id, e.title, e.venue, e.event_date, e.status FROM physi_block_txs b JOIN physi_events e ON e.id = b.event_id WHERE b.round_number = ${n} ORDER BY e.created_at`;
      // lattice grid preview: prefer canonical schedule version (winning grid), fallback to winning proof grid
      let grid_hex: string | null = null;
      let schedule_cells: { row: number; col: number; hall: string; period: string; programme: string; level: string }[] | null = null;
      try {
        const [sv] = await sql`SELECT grid, lattice_order FROM physi_schedule_versions WHERE version = ${n} LIMIT 1`;
        if (sv?.grid) {
          const buf: Buffer = sv.grid;
          let hex = "";
          for (let i = 0; i < buf.length; i++) hex += buf[i].toString(16);
          grid_hex = hex.slice(0, 2 * sv.lattice_order * sv.lattice_order);
          // build lightweight preview cells inline to avoid extra import
          try {
            const { gridToSchedule } = await import("@/lib/schedule");
            schedule_cells = gridToSchedule(grid_hex, sv.lattice_order) as any;
          } catch {}
        } else {
          // fallback: winning proof grid for this round
          const [pr] = await sql`SELECT grid, lattice_order FROM physi_round_proofs JOIN physi_rounds r2 ON r2.number = physi_round_proofs.round_number AND r2.number = ${n} WHERE physi_round_proofs.ticket_hex = r.winning_ticket LIMIT 1`;
          if (pr?.grid) {
            const buf: Buffer = pr.grid;
            let hex = "";
            for (let i = 0; i < buf.length; i++) hex += buf[i].toString(16);
            grid_hex = hex.slice(0, 2 * pr.lattice_order * pr.lattice_order);
            try {
              const { gridToSchedule } = await import("@/lib/schedule");
              schedule_cells = gridToSchedule(grid_hex, pr.lattice_order) as any;
            } catch {}
          }
        }
      } catch {}
      return NextResponse.json({ ok: true, block: r, txs, grid_hex, lattice_order: r.lattice_order, lattice_preview: schedule_cells });
    }
    if (u.searchParams.get("view") === "leaders") {
      const includeTest = u.searchParams.get("lab") === "1";
      return NextResponse.json({ ok: true, leaders: await leaderboard(limit, includeTest) });
    }
    return NextResponse.json({
      ok: true,
      rounds: await recentRounds(limit),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
