import { NextResponse } from "next/server";
import { voteHall, listHalls } from "@/lib/domains/aliases";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    return NextResponse.json({ ok: true, proposals: await listHalls(u.searchParams.get("status") || undefined) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const res = await voteHall(await req.json());
    return NextResponse.json({ ok: true, ...res }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
