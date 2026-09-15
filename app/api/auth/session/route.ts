import { NextResponse } from "next/server";
import { issueSession, validateSession } from "@/lib/domains/auth";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const h = req.headers.get("authorization") || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (!token) {
      return NextResponse.json({ ok: false, code: "NO_TOKEN", message: "Bearer token required." }, { status: 401 });
    }
    return NextResponse.json({ ok: true, authenticated: true, ...(await validateSession(token)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.user_id) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "user_id is required." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(await issueSession(body.user_id)) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
