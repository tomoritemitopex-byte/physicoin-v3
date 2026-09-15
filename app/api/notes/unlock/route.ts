import { NextResponse } from "next/server";
import { unlock } from "@/lib/domains/notes";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    return NextResponse.json({ ok: true, ...(await unlock(await req.json())) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
