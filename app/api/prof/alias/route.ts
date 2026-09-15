import { NextResponse } from "next/server";
import { voteProf } from "@/lib/domains/aliases";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const res = await voteProf(await req.json());
    return NextResponse.json({ ok: true, ...res }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
