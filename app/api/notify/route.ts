import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Outgoing notifications. Delivers to Telegram only when the server is
// configured for it; otherwise says so honestly instead of pretending.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const event = body.event;
    if (!event?.title) {
      return NextResponse.json({ ok: false, code: "MISSING_FIELDS", message: "event.title is required." }, { status: 400 });
    }
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chat = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chat) {
      return NextResponse.json({ ok: true, delivered: false, reason: "NO_CHANNEL" });
    }
    const text = `✅ ${event.title} @ ${event.venue} (${event.event_date} ${event.event_time})`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text }),
        signal: ctl.signal,
      });
      return NextResponse.json({ ok: r.ok, delivered: r.ok });
    } finally {
      clearTimeout(t);
    }
  } catch {
    return NextResponse.json({ ok: false, code: "INTERNAL", message: "Something went wrong." }, { status: 500 });
  }
}
