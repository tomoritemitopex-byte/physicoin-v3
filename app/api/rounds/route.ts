import { NextResponse } from "next/server";
import { recentRounds } from "@/lib/domains/rounds";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    return NextResponse.json({
      ok: true,
      rounds: await recentRounds(Number(u.searchParams.get("limit")) || 20),
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
