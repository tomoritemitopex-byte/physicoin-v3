import { NextResponse } from "next/server";
import { createSchool, listSchools, reviewSchool } from "@/lib/domains/schools";
import { toErrorResponse } from "@/lib/errors";

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
    return NextResponse.json({ ok: true, school: await createSchool(await req.json()) }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    return NextResponse.json({ ok: true, school: await reviewSchool(await req.json()) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
