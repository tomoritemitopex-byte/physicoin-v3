import { NextResponse } from "next/server";
import { upcomingAlerts } from "@/lib/domains/misc";
import { toErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

async function handle(input: { programme?: string; level?: string }) {
  return NextResponse.json({ ok: true, events: await upcomingAlerts(input) });
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    return handle({
      programme: u.searchParams.get("programme") || undefined,
      level: u.searchParams.get("level") || undefined,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    return handle(await req.json().catch(() => ({})));
  } catch (e) {
    return toErrorResponse(e);
  }
}
