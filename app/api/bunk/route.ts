import { NextResponse } from "next/server";
import { report, status, recent } from "@/lib/domains/bunk";
import { toErrorResponse } from "@/lib/errors";

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
    return NextResponse.json({ ok: true, ...(await report(await req.json())) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
