import { NextResponse } from "next/server";
import { DomainError } from "@/lib/domains/users";
import { logEvent } from "@/lib/log";

export function toErrorResponse(e: unknown, route?: { method: string; path: string }) {
  if (e instanceof DomainError) {
    return NextResponse.json({ ok: false, code: e.code, message: e.message }, { status: e.status });
  }
  const msg = String((e as Error)?.message || e);
  if (msg === "DB_NOT_CONFIGURED") {
    return NextResponse.json({ ok: false, code: "DB_NOT_CONFIGURED", message: "DATABASE_URL is not set." }, { status: 503 });
  }
  console.error("[api]", msg.slice(0, 300));
  if (route) logEvent({ ...route, status: 500, message: msg.slice(0, 160) });
  return NextResponse.json({ ok: false, code: "INTERNAL", message: "Something went wrong." }, { status: 500 });
}
