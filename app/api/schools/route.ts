import { NextResponse } from "next/server";
import { createSchool, listSchools, reviewSchool } from "@/lib/domains/schools";
import { toErrorResponse } from "@/lib/errors";
import { actor, cap } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    return NextResponse.json({ ok: true, schools: await listSchools(u.searchParams.get("status") || undefined) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const uid = await actor(req, body, "created_by");
    return NextResponse.json({ ok: true, school: await createSchool({ ...body, name: cap(body.name, 200), created_by: body.created_by || uid }) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    await actor(req, body, "reviewer_id");
    if (!body.reviewer_id) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "reviewer_id is required." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, school: await reviewSchool(body) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
