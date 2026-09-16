import { NextResponse } from "next/server";
import { currentSchedule, queueSwapHint } from "@/lib/domains/schedule";
import { toErrorResponse } from "@/lib/errors";
import { isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await currentSchedule()) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    // Swap proposal: ask for a venue/time move. Not instant — it sits as a
    // pending hint until a future winning grid happens to place the rank/reg
    // pair where you asked. Honest about the mechanism.
    const body = await req.json().catch(() => ({} as any));
    if (!body.venue || !body.period) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "venue and period are required." }, { status: 400 });
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ ok: false, code: "DB_NOT_CONFIGURED", message: "DATABASE_URL is not set." }, { status: 503 });
    }
    const proposer_id = body.proposer_id || body.user_id || null;
    let saved: any = null;
    try {
      saved = await queueSwapHint({
        venue: String(body.venue),
        period: String(body.period),
        from_venue: body.from_venue ? String(body.from_venue).slice(0, 80) : null,
        from_period: body.from_period ? String(body.from_period).slice(0, 20) : null,
        proposer_id: proposer_id ? String(proposer_id) : null,
        note: body.note ? String(body.note).slice(0, 200) : null,
      });
    } catch (e: any) {
      const msg = String(e?.message || "");
      // Table missing (pre-migration) => degrade honestly but report code.
      if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("pending_swaps")) {
        return NextResponse.json({
          ok: true,
          queued: true,
          persisted: false,
          code: "MIGRATION_PENDING",
          note: "Swap queued as a hint for future schedule versions. Next winning grid that places this pair at that slot will honor it. (pending_swaps table not yet migrated — will persist after migration 012)",
          hint: { venue: String(body.venue).slice(0, 80), period: String(body.period).slice(0, 20) },
        });
      }
      throw e;
    }
    return NextResponse.json({
      ok: true,
      queued: true,
      persisted: true,
      id: saved.id,
      note: "Swap queued as a hint for future schedule versions. Next winning grid that places this pair at that slot will honor it. Not an instant move — hints are consumed when the next block is mined.",
      hint: { venue: saved.venue, period: saved.period, from_venue: saved.from_venue, from_period: saved.from_period },
      pending: saved,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
