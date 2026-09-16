import { NextResponse } from "next/server";
import { ping, heat } from "@/lib/domains/squad";
import { toErrorResponse } from "@/lib/errors";
import { actor } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    return NextResponse.json({
      ok: true,
      ...(await heat({
        programme: u.searchParams.get("programme") || undefined,
        level: u.searchParams.get("level") || undefined,
        viewer_id: u.searchParams.get("viewer_id") || undefined,
      })),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const uid = await actor(req, body, "user_id");
    return NextResponse.json({ ok: true, ping: await ping({ ...body, user_id: body.user_id || uid }) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
