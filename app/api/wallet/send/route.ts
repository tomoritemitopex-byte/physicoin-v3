import { NextResponse } from "next/server";
import { send, history } from "@/lib/domains/transfers";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const user_id = u.searchParams.get("user_id") || "";
    return NextResponse.json({ ok: true, transfers: await history(user_id) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const h = req.headers.get("authorization") || "";
    const body = await req.json();
    const token = body.token || (h.startsWith("Bearer ") ? h.slice(7) : "");
    const res = await send({ ...body, token });
    return NextResponse.json({ ok: true, ...res }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
