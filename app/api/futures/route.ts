import { NextResponse } from "next/server";
import { stake, listOpenFutures, listFutures } from "@/lib/domains/futures";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const event_id = u.searchParams.get("event_id") || "";
    if (!event_id) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "event_id is required." }, { status: 400 });
    }
    const status = u.searchParams.get("status") || undefined;
    // Default: list open futures for the event
    const futures = status ? await listFutures(event_id, status) : await listOpenFutures(event_id);
    return NextResponse.json({ ok: true, futures, count: futures.length, event_id });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const h = req.headers.get("authorization") || "";
    const token = body.token || (h.startsWith("Bearer ") ? h.slice(7) : "");
    const event_id = body.event_id;
    const staker_id = body.staker_id || body.user_id;
    const direction = body.direction;

    if (!event_id || !staker_id || !direction) {
      return NextResponse.json(
        { ok: false, code: "MISSING_FIELDS", message: "event_id, staker_id and direction are required." },
        { status: 400 }
      );
    }

    const future = await stake(event_id, staker_id, direction, token);
    return NextResponse.json({ ok: true, future }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
