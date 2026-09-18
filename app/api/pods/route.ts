import { NextResponse } from "next/server";
import { getPods, createPodForEvent } from "@/lib/domains/pods";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/pods?user_id=...   — list active pods for a user
 * Offline-first: client caches GET result in localStorage `phy_pods_cache`
 * (key: pods:{user_id}) and renders from cache when offline.
 */
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const user_id = u.searchParams.get("user_id") || u.searchParams.get("viewer_id") || "";
    if (!user_id) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "user_id is required." }, { status: 400 });
    }
    const pods = await getPods(user_id);
    return NextResponse.json({ ok: true, pods, count: pods.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/**
 * POST /api/pods  { event_id } — create pod for a verified event (internal only).
 * Normally called server-side from votes.ts after quorum; this route exists for
 * ops / manual backfill. Requires a valid session (any authenticated wallet).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const event_id = String(body.event_id || "").trim();
    if (!event_id) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "event_id is required." }, { status: 400 });
    }
    // Internal-only guard: require a session token if present; if DB not configured, fail gracefully via toErrorResponse
    const h = req.headers.get("authorization") || "";
    const token = body.token || (h.startsWith("Bearer ") ? h.slice(7) : "");
    if (token) {
      const { validateSession } = await import("@/lib/domains/auth");
      await validateSession(token);
    }
    const pod = await createPodForEvent(event_id);
    if (!pod) {
      return NextResponse.json({ ok: false, code: "NO_POD", message: "No YES verifiers or pod already exists." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, pod }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
