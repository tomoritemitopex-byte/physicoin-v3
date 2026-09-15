import { NextResponse } from "next/server";
import { cohortInfo } from "@/lib/domains/misc";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const user_id = u.searchParams.get("user_id") || "";
    return NextResponse.json({ ok: true, ...(await cohortInfo(user_id)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
