import { NextResponse } from "next/server";
import { voteProf } from "@/lib/domains/aliases";
import { toErrorResponse } from "@/lib/errors";
import { actor } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const uid = await actor(req, body, "voter_id");
    const res = await voteProf({ ...body, voter_id: body.voter_id || uid });
    return NextResponse.json({ ok: true, ...res }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
