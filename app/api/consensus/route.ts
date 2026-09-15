import { NextResponse } from "next/server";
import { consensusFeed } from "@/lib/domains/misc";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await consensusFeed()) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
