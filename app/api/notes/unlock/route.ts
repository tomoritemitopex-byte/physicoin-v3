import { NextResponse } from "next/server";
import { unlock } from "@/lib/domains/notes";
import { toErrorResponse } from "@/lib/errors";
import { actor } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const uid = await actor(req, body, "user_id");
    if (!body.user_id || body.user_id !== uid) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "user_id is required." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(await unlock(body)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
