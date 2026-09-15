import { NextResponse } from "next/server";
import { postEvent, listEvents } from "@/lib/domains/events";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const events = await listEvents({
      status: u.searchParams.get("status") || undefined,
      limit: Number(u.searchParams.get("limit")) || 50,
    });
    return NextResponse.json({ ok: true, events, count: events.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await postEvent(body);
    if ("duplicate" in res) {
      return NextResponse.json({ ok: true, duplicate: true, existing: res.existing }, { status: 200 });
    }
    return NextResponse.json({ ok: true, event: res.event }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
