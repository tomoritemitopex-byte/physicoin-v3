import { NextResponse } from "next/server";
import { ping, heat } from "@/lib/domains/squad";
import { toErrorResponse } from "@/lib/errors";

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
    return NextResponse.json({ ok: true, ping: await ping(await req.json()) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
