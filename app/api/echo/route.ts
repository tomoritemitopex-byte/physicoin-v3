import { NextResponse } from "next/server";
import { echoStrength } from "@/lib/domains/misc";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const event_id = u.searchParams.get("event_id") || "";
    return NextResponse.json({ ok: true, ...(await echoStrength(event_id)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
