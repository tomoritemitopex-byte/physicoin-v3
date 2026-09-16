import { NextResponse } from "next/server";
import { drop, feed } from "@/lib/domains/notes";
import { toErrorResponse } from "@/lib/errors";
import { actorOptional, cap } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    return NextResponse.json({
      ok: true,
      notes: await feed({
        building_id: u.searchParams.get("building_id") || undefined,
        level: u.searchParams.get("level") || undefined,
        viewer_id: u.searchParams.get("viewer_id") || undefined,
      }),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await actorOptional(req, body, "uploader_id");
    return NextResponse.json({ ok: true, note: await drop({ ...body, title: cap(body.title, 200) }) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
