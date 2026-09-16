import { NextResponse } from "next/server";
import { createDispute, listDisputes, resolveDispute } from "@/lib/domains/schools";
import { toErrorResponse } from "@/lib/errors";
import { anySession, actor } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    return NextResponse.json({ ok: true, disputes: await listDisputes(u.searchParams.get("status") || undefined) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await anySession(req);
    return NextResponse.json({ ok: true, dispute: await createDispute(body) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    await actor(req, body, "resolved_by");
    if (!body.resolved_by) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "resolved_by is required." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(await resolveDispute(body)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
