import { NextResponse } from "next/server";
import { thread, sendDM } from "@/lib/domains/dms";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

function tokenOf(req: Request, body?: any): string {
  if (body?.token) return body.token;
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : "";
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const user_id = u.searchParams.get("user_id") || "";
    const peer = u.searchParams.get("with") || "";
    return NextResponse.json({ ok: true, messages: await thread(user_id, peer, tokenOf(req)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.from_user_id || !body.to) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "from_user_id and to are required." }, { status: 400 });
    }
    return NextResponse.json(
      { ok: true, message: await sendDM({ ...body, token: tokenOf(req, body) }) },
      { status: 201 }
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
