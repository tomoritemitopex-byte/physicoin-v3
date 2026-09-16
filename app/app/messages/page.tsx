"use client";
import { useEffect, useState } from "react";

export default function MessagesPage({ searchParams }: { searchParams?: { with?: string } }) {
  const [me, setMe] = useState("");
  const [peer, setPeer] = useState(searchParams?.with || "");
  const [draft, setDraft] = useState("");
  const [msgs, setMsgs] = useState<any[]>([]);
  const [note, setNote] = useState("");

  async function authed(userId: string) {
    const s = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }).then((r) => r.json());
    return s.ok ? (s.token as string) : "";
  }

  async function load() {
    try {
      const raw = localStorage.getItem("physi_profile");
      const id = raw ? JSON.parse(raw)?.id : "";
      if (!id || !peer) return;
      setMe(id);
      const token = await authed(id);
      if (!token) return;
      const r = await fetch(`/api/dm?user_id=${encodeURIComponent(id)}&with=${encodeURIComponent(peer)}`, {
        headers: { authorization: `Bearer ${token}` },
      }).then((x) => x.json());
      if (r.ok) setMsgs(r.messages);
    } catch {}
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peer]);

  async function send() {
    if (!draft.trim() || !me || !peer) return;
    setNote("Sending…");
    try {
      const token = await authed(me);
      const r = await fetch("/api/dm", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ from_user_id: me, to: peer, body: draft }),
      }).then((x) => x.json());
      if (r.ok) {
        setDraft("");
        setNote("");
        load();
      } else {
        setNote(r.message || "Could not send.");
      }
    } catch {
      setNote("Network error.");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 pb-24">
      <h1 className="font-display text-3xl font-black tracking-tight">Messages</h1>
      <p className="mt-1 text-sm text-ink/60">Private line. Only the two wallets in a chat can read it.</p>
      <input
        value={peer}
        onChange={(e) => setPeer(e.target.value)}
        placeholder="Their handle or wallet id"
        className="mt-4 w-full rounded-xl border border-sky/30 bg-white px-4 py-2.5 text-sm"
      />
      <div className="slip mt-4 space-y-3 p-4 pt-6">
        {msgs.length === 0 && <p className="text-sm text-ink/50">No messages yet. Say hello.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from_user === me ? "ml-auto bg-ink text-white" : "bg-sky/20"}`}>
            <p>{m.body}</p>
            <p className={`mt-1 font-mono text-[10px] ${m.from_user === me ? "text-white/60" : "text-ink/50"}`}>
              {String(m.created_at).slice(11, 16)}
              {m.from_user === me ? (m.read ? " · read" : " · sent") : ""}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Write…"
          maxLength={500}
          className="flex-1 rounded-full border border-sky/30 bg-white px-4 py-2.5 text-sm"
        />
        <button onClick={send} className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white">
          Send
        </button>
      </div>
      {note && <p className="mt-2 font-mono text-xs text-ink/60">{note}</p>}
    </div>
  );
}
