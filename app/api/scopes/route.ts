import { NextResponse } from "next/server";
import { voteScope, getScopeStatus } from "@/lib/domains/aliases";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const a = u.searchParams.get("a") || "";
    const b = u.searchParams.get("b") || "";
    if (!a || !b) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "a and b are required." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(await getScopeStatus(a, b)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const res = await voteScope(await req.json());
    return NextResponse.json({ ok: true, ...res }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
