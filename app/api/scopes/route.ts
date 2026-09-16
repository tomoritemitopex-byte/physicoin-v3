import { NextResponse } from "next/server";
import { voteScope, getScopeStatus } from "@/lib/domains/aliases";
import { toErrorResponse } from "@/lib/errors";
import { actor } from "@/lib/guard";

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
    const body = await req.json();
    const uid = await actor(req, body, "voter_id");
    const res = await voteScope({ ...body, voter_id: body.voter_id || uid });
    return NextResponse.json({ ok: true, ...res }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
