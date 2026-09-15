import { NextResponse } from "next/server";
import { resolveProf } from "@/lib/domains/aliases";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const name = u.searchParams.get("name") || u.searchParams.get("prof") || "";
    return NextResponse.json({ ok: true, ...(await resolveProf(name)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
