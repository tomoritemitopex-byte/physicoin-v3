"use client";
import { useEffect, useState } from "react";

export default function MessagesPage({ searchParams }: { searchParams?: { with?: string } }) {
  const [me, setMe] = useState("");
  const [peer, setPeer] = useState(searchParams?.with || "");
  const [draft, setDraft] = useState("");
  const [msgs, setMsgs] = useState<any[]>([]);
  const [note, setNote] = useState("");

  async function authed(userId: string) {
    return localStorage.getItem("physi_session") || "";
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
    <div className="mx-auto max-w-lg px-4 py-8 pb-24">
      <p className="kicker text-brick">direct line</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">MESSAGES.</h1>
      <p className="mt-2 text-sm leading-6 text-ink/65">
        Private line. Only the two wallets in a chat can read it.
      </p>

      <label className="mt-5 block font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/65">
        Chat with
      </label>
      <input
        value={peer}
        onChange={(e) => setPeer(e.target.value)}
        placeholder="their handle or wallet id"
        className="mt-1 w-full px-4 py-2.5 text-sm"
      />

      <div className="mt-4 min-h-[240px] space-y-3 border-[3px] border-ink bg-paper-2 p-3 shadow-brutal">
        {msgs.length === 0 && (
          <p className="py-10 text-center font-mono text-xs uppercase tracking-[0.12em] text-ink/60">
            no messages yet — say hello
          </p>
        )}
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] border-[3px] border-ink px-3 py-2 text-sm shadow-brutal-sm ${
              m.from_user === me ? "ml-auto bg-ink text-white" : "bg-white text-ink"
            }`}
          >
            <p>{m.body}</p>
            <p className={`mt-1 font-mono text-[10px] ${m.from_user === me ? "text-white/55" : "text-ink/65"}`}>
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
          className="flex-1 px-4 py-2.5 text-sm"
        />
        <button onClick={send} className="brutal-btn brutal-btn--coral shrink-0">
          Send
        </button>
      </div>
      {note && <p className="mt-2 font-mono text-[11px] text-ink/55">{note}</p>}
    </div>
  );
}
