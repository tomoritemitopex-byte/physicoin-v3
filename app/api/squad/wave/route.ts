import { NextResponse } from "next/server";
import { wave, inbox } from "@/lib/domains/squad";
import { toErrorResponse } from "@/lib/errors";
import { actor } from "@/lib/guard";

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
    const body = await req.json();
    const uid = await actor(req, body, "from_user");
    if (!body.from_user || body.from_user !== uid) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "from_user is required." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, wave: await wave(body) }, { status: 201 });  } catch (e) {
    return toErrorResponse(e);
  }
}
