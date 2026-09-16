import { NextResponse } from "next/server";
import { castVote, getTally } from "@/lib/domains/votes";
import { toErrorResponse } from "@/lib/errors";
import { actor } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const event_id = u.searchParams.get("event_id");
    if (!event_id) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "event_id is required." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(await getTally(event_id)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const uid = await actor(req, body, "verifier_id");
    const { tally } = await castVote({ ...body, verifier_id: body.verifier_id || uid });
    return NextResponse.json({ ok: true, ...tally });
  } catch (e) {
    return toErrorResponse(e);
  }
}
