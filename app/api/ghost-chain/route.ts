import { NextResponse } from "next/server";
import { ghostChain } from "@/lib/domains/misc";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const user_id = u.searchParams.get("user_id") || "";
    const verify = u.searchParams.get("verify") === "1";
    return NextResponse.json({ ok: true, ...(await ghostChain(user_id, verify)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
