import { NextResponse } from "next/server";
import { getTelemetry } from "@/lib/domains/telemetry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const limit = Number(u.searchParams.get("limit")) || 20;
    const data = await getTelemetry(limit);
    return NextResponse.json({
      ok: true,
      flags: data.flags,
      recentRounds: data.recentRounds,
      rounds: data.rounds,
      subsCounts: data.subsCounts,
      subs: data.subsCounts,
      limit,
      at: new Date().toISOString(),
    });
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (msg.includes("DB_NOT_CONFIGURED")) {
      return NextResponse.json(
        { ok: true, flags: { SATURATED: false, BAR_MAX: false, LATTICE_STALL: false, detail: { saturatedWindow: null, barMaxRounds: [], stallReason: null } }, recentRounds: [], rounds: [], subsCounts: {}, subs: {}, at: new Date().toISOString(), degraded: true },
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: false, code: "INTERNAL", message: "telemetry failed" }, { status: 500 });
  }
}
