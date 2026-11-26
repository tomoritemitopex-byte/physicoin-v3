import { NextResponse } from "next/server";
import { eventProof } from "@/lib/domains/proofs";
import { toErrorResponse } from "@/lib/errors";
import { requireUuid } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const event_id = requireUuid(u.searchParams.get("event_id"), "event_id");
    return NextResponse.json({ ok: true, ...(await eventProof(event_id)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
