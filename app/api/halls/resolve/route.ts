import { NextResponse } from "next/server";
import { resolveHall } from "@/lib/domains/aliases";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const alias = u.searchParams.get("alias") || "";
    return NextResponse.json({ ok: true, ...(await resolveHall(alias)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
