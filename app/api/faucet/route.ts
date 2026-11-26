import { NextResponse } from "next/server";
import { getFaucetStatus } from "@/lib/domains/faucet";
import { toErrorResponse } from "@/lib/errors";
import { requireUuid } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const user_id = requireUuid(u.searchParams.get("user_id") || u.searchParams.get("id"), "user_id");
    const status = await getFaucetStatus(user_id);
    return NextResponse.json({ ok: true, ...status });
  } catch (e) {
    return toErrorResponse(e);
  }
}
