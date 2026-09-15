import { NextResponse } from "next/server";
import { recentRounds, leaderboard } from "@/lib/domains/rounds";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const limit = Number(u.searchParams.get("limit")) || 20;
    if (u.searchParams.get("view") === "leaders") {
      const includeTest = u.searchParams.get("lab") === "1";
      return NextResponse.json({ ok: true, leaders: await leaderboard(limit, includeTest) });
    }
    return NextResponse.json({
      ok: true,
      rounds: await recentRounds(limit),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
