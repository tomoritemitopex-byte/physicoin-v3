import { NextResponse } from "next/server";
import { getLogs } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    return NextResponse.json({ ok: true, ...getLogs(Number(u.searchParams.get("limit")) || 100) });
  } catch {
    return NextResponse.json({ ok: false, code: "INTERNAL", message: "Something went wrong." }, { status: 500 });
  }
}
