import { NextResponse } from "next/server";
import { report, status, recent } from "@/lib/domains/bunk";
import { toErrorResponse } from "@/lib/errors";
import { actorOptional } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const event_id = u.searchParams.get("event_id");
    if (!event_id) return NextResponse.json({ ok: true, recent: await recent() });
    return NextResponse.json({ ok: true, ...(await status(event_id)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Anonymous reports allowed; a NAMED reporter must own the session.
    await actorOptional(req, body, "reporter_id");
    return NextResponse.json({ ok: true, ...(await report(body)) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
