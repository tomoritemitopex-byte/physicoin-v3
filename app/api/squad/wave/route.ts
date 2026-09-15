import { NextResponse } from "next/server";
import { wave, inbox } from "@/lib/domains/squad";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const user_id = u.searchParams.get("user_id") || "";
    return NextResponse.json({ ok: true, waves: await inbox(user_id) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    return NextResponse.json({ ok: true, wave: await wave(await req.json()) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
