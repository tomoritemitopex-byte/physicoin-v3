import { NextResponse } from "next/server";
import { revokeSession } from "@/lib/domains/auth";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const h = req.headers.get("authorization") || "";
    const body = await req.json().catch(() => ({} as any));
    const token = body.token || (h.startsWith("Bearer ") ? h.slice(7) : "");
    if (!token) {
      return NextResponse.json({ ok: false, code: "NO_TOKEN", message: "Token required." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(await revokeSession(token)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
