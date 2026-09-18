import { NextResponse } from "next/server";
import { postEvent, listEvents } from "@/lib/domains/events";
import { toErrorResponse } from "@/lib/errors";
import { actor, cap } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const events = await listEvents({
      status: u.searchParams.get("status") || undefined,
      limit: Number(u.searchParams.get("limit")) || 50,
    });
    return NextResponse.json({ ok: true, events, count: events.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const uid = await actor(req, body, "created_by");
    const res = await postEvent({
      ...body,
      title: cap(body.title, 200),
      venue: cap(body.venue, 200),
      created_by: body.created_by || uid,
    });
    if ("duplicate" in res) {
      return NextResponse.json({ ok: true, duplicate: true, existing: res.existing }, { status: 200 });
    }
    // Invisible mining: a timetable edit IS the mine.
    // If ticket fields are supplied, record that proof for the event's round;
    // otherwise auto-grind a ticket in background (graceful — no failure if cap hit).
    // The event is already created; mining is secondary.
    let mining: { via?: string; round?: number; skipped?: string } | null = null;
    const token: string = body.token || (req.headers.get("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7) : "");
    const hasTicket = body.ticket_hex && body.salt !== undefined && body.nonce !== undefined && body.grid_hex && body.score !== undefined;
    try {
      if (token && uid) {
        if (hasTicket) {
          const { recordProof, roundNumberAt } = await import("@/lib/domains/rounds");
          const rnd = typeof body.round === "number" ? body.round : roundNumberAt(Date.now());
          try {
            await recordProof(uid, rnd, Number(body.nonce), String(body.grid_hex), Number(body.score), String(body.salt), token, String(body.ticket_hex), Number(body.version) || 1);
            mining = { via: "ticket", round: rnd };
          } catch (e: any) {
            // Graceful: 25 cap, budget, round closed — keep event, report skip
            if (e?.code === "RATE_LIMITED" || e?.code === "PROOF_BUDGET_EXHAUSTED" || e?.code === "ROUND_CLOSED" || e?.code === "BAD_PROOF") {
              mining = { via: "ticket", skipped: e.code };
            } else {
              throw e;
            }
          }
        } else if (body._mine !== false) {
          // Auto-grind via server (covers clients that don't pre-grind)
          const { grindAndSubmit } = await import("@/lib/domains/rounds");
          try {
            const gr = await grindAndSubmit(uid, token);
            mining = { via: "auto", round: (gr as any).round };
          } catch (e: any) {
            if (e?.code === "RATE_LIMITED" || e?.code === "PROOF_BUDGET_EXHAUSTED" || e?.code === "ROUND_CLOSED" || e?.code === "DUPLICATE_PROOF") {
              mining = { via: "auto", skipped: e.code };
            } else {
              throw e;
            }
          }
        }
        // Link event to round for verifiability (graceful — no failure if tables missing)
        if (mining && mining.round !== undefined) {
          try {
            const { getDb } = await import("@/lib/db");
            const sql = getDb();
            await sql`INSERT INTO physi_block_txs (round_number, event_id) VALUES (${mining.round}, ${res.event.id}) ON CONFLICT DO NOTHING`;
          } catch {}
        }
      }
    } catch (e) {
      // Never fail the timetable post because mining failed
      console.error("[timetable mining]", String((e as Error)?.message || e).slice(0, 200));
    }
    return NextResponse.json({ ok: true, event: res.event, mining }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
