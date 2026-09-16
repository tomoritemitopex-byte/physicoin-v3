import { NextResponse } from "next/server";
import { createDepartment, listDepartments } from "@/lib/domains/schools";
import { toErrorResponse } from "@/lib/errors";
import { actor, cap } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const school_id = u.searchParams.get("school_id") || "";
    return NextResponse.json({ ok: true, departments: await listDepartments(school_id) });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const uid = await actor(req, body, "created_by");
    return NextResponse.json({ ok: true, department: await createDepartment({ ...body, name: cap(body.name, 200), created_by: body.created_by || uid }) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
