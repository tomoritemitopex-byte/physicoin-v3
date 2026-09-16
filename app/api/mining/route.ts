import { NextResponse } from "next/server";
import { grindAndSubmit, recordProof, roundWins, currentRound, miningDashboard } from "@/lib/domains/rounds";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Round mining: POST grinds one proof (or records yours) into the open round.
// One winner per round. GET shows your round wins.
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const user_id = u.searchParams.get("user_id") || "";
    if (u.searchParams.get("round") === "current" || !user_id) {
      return NextResponse.json({ ok: true, ...(await currentRound()) });
    }
    return NextResponse.json({ ok: true, wins: await roundWins(user_id) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const h = req.headers.get("authorization") || "";
    const body = await req.json();
    if (!body.user_id) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "user_id is required." }, { status: 400 });
    }
    const token = body.token || (h.startsWith("Bearer ") ? h.slice(7) : "");
    if (!token) {
      return NextResponse.json({ ok: false, code: "NO_TOKEN", message: "Wallet session required — fetch one from /api/auth/session first." }, { status: 401 });
    }
    if (body.nonce !== undefined && body.grid_hex && body.score !== undefined) {
      const res = await recordProof(body.user_id, body.round, body.nonce, body.grid_hex, body.score, body.salt || "", token, body.ticket_hex || "", body.version || 1);
      return NextResponse.json({ ok: true, recorded: true, ...res }, { status: 201 });
    }
    const res = await grindAndSubmit(body.user_id, token);
    return NextResponse.json({ ok: true, submitted: true, ...res }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
