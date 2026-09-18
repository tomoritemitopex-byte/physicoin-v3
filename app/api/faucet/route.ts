import { NextResponse } from "next/server";
import { getFaucetStatus } from "@/lib/domains/faucet";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const user_id = u.searchParams.get("user_id") || u.searchParams.get("id") || "";
    if (!user_id) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "user_id is required." }, { status: 400 });
    }
    const status = await getFaucetStatus(user_id);
    return NextResponse.json({ ok: true, ...status });
  } catch (e) {
    return toErrorResponse(e);
  }
}
