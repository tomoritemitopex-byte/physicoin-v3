import { NextResponse } from "next/server";
import { dayHeader } from "@/lib/domains/proofs";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    return NextResponse.json({ ok: true, header: await dayHeader(u.searchParams.get("date") || undefined) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
