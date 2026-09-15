import { NextResponse } from "next/server";
import { repeatSchedule } from "@/lib/domains/misc";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.user_id) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "user_id is required." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...(await repeatSchedule(body.user_id, body.scope_value)) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
