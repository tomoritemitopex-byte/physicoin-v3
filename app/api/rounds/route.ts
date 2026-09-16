import { NextResponse } from "next/server";
import { recentRounds, leaderboard } from "@/lib/domains/rounds";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const limit = Number(u.searchParams.get("limit")) || 20;
    const round = u.searchParams.get("round");
    if (round) {
      const n = Number(round);
      const sql = (await import("@/lib/db")).getDb();
      const [r] = await sql`SELECT number, status, winning_score, winning_ticket, prev_hash, tx_root, tx_count, lattice_order, difficulty FROM physi_rounds WHERE number = ${n} LIMIT 1`;
      if (!r) return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 404 });
      const txs = await sql`SELECT e.id, e.title, e.venue, e.event_date, e.status FROM physi_block_txs b JOIN physi_events e ON e.id = b.event_id WHERE b.round_number = ${n} ORDER BY e.created_at`;
      return NextResponse.json({ ok: true, block: r, txs });
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
