import { NextResponse } from "next/server";
import { cloakedBaseUrl, getCloakedHealth } from "@/lib/cloaked/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getCloakedHealth();
  return NextResponse.json(
    { service: "cloaked-physicoin", baseUrl: cloakedBaseUrl(), ...health },
    { status: health.reachable ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
