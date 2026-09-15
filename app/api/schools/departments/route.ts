import { NextResponse } from "next/server";
import { createDepartment, listDepartments } from "@/lib/domains/schools";
import { toErrorResponse } from "@/lib/errors";

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
    return NextResponse.json({ ok: true, department: await createDepartment(await req.json()) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
