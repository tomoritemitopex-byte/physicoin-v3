import { NextResponse } from "next/server";
import { createDispute, listDisputes, resolveDispute } from "@/lib/domains/schools";
import { toErrorResponse } from "@/lib/errors";

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
    return NextResponse.json({ ok: true, dispute: await createDispute(await req.json()) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    return NextResponse.json({ ok: true, ...(await resolveDispute(await req.json())) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
