import { NextResponse } from "next/server";
import { send, history } from "@/lib/domains/transfers";
import { toErrorResponse } from "@/lib/errors";
import { validateSession } from "@/lib/domains/auth";
import { DomainError } from "@/lib/domains/users";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const user_id = u.searchParams.get("user_id") || "";
    const h = req.headers.get("authorization") || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (!token) {
      throw new DomainError("NO_TOKEN", "Wallet session required.", 401);
    }
    const { user_id: me } = await validateSession(token);
    if (me !== user_id) {
      throw new DomainError("NOT_YOURS", "This session cannot read that wallet.", 403);
    }
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
