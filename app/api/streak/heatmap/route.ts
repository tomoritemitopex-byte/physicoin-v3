import { NextResponse } from "next/server";
import { streakHeatmap } from "@/lib/domains/misc";
import { toErrorResponse } from "@/lib/errors";
import { requireUuid } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const user_id = requireUuid(u.searchParams.get("user_id"), "user_id");
    const days = Number(u.searchParams.get("days")) || 30;
    return NextResponse.json({ ok: true, ...(await streakHeatmap(user_id, days)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
