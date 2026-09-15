import { NextResponse } from "next/server";
import { getDb, isDbConfigured, dbNotConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json(dbNotConfigured(), { status: 503 });
  }
  try {
    const sql = getDb();
    await sql`SELECT 1 AS ok`;
    const [{ count }] = await sql`SELECT count(*)::int AS count
      FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'physi_%'`;
    return NextResponse.json({ ok: true, db: true, physi_tables: count, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, code: "DB_UNREACHABLE", message: String((e as Error)?.message || e) },
      { status: 503 }
    );
  }
}
