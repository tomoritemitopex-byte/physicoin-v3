import { NextResponse } from "next/server";
import { stats } from "@/lib/domains/misc";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await stats()) });
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (msg.includes("DB_NOT_CONFIGURED")) {
      return NextResponse.json(
        { ok: true, users: 0, events: 0, verifications: 0, mined: 0, events_by_status: {}, users_7d: 0, events_7d: 0, users_new_7d: 0, events_new_7d: 0, degraded: true },
        { status: 200 }
      );
    }
    return toErrorResponse(e);
  }
}
