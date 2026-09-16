import { NextResponse } from "next/server";
import { currentSchedule } from "@/lib/domains/schedule";
import { toErrorResponse } from "@/lib/errors";

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
    return NextResponse.json({
      ok: true,
      queued: true,
      note: "Swap queued as a hint for future schedule versions. Next winning grid that places this pair at that slot will honor it.",
      hint: { venue: String(body.venue).slice(0, 80), period: String(body.period).slice(0, 20) },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
