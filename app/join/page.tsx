"use client";
import { useEffect, useState } from "react";

// Open door to the node: anyone can create a handle and mine.
// Voluntary — nobody is charged, nobody is forced to send anything.
// ?ref=<user_id> names who invited you (no bonus, just credit).

export default function JoinPage({ searchParams }: { searchParams?: { ref?: string } }) {
  const ref = searchParams?.ref || "";
  const [inviter, setInviter] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!ref) return;
    fetch(`/api/profile?id=${encodeURIComponent(ref)}`)
      .then((r) => r.json())
      .then((j) => j.ok && setInviter(j.user.nickname))
      .catch(() => {});
  }, [ref]);

  async function start() {
    setBusy(true);
    setMsg("Creating handle…");
    try {
      const c = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: nickname, nickname, programme: "PHYS", level: "100L" }),
      }).then((r) => r.json());
      if (!c.ok) {
        setMsg(c.message || "Handle failed — try another.");
        setBusy(false);
        return;
      }
      localStorage.setItem("physi_profile", JSON.stringify(c.user));
      setMsg("Mining your first coin — grinding proof…");
      const m = await fetch("/api/mining", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: c.user.id }),
      }).then((r) => r.json());
      if (m.ok) {
        setMsg(`Welcome, @${c.user.nickname} — first coin mined (proof nonce ${m.proof.nonce}).`);
        setDone(true);
      } else {
        setMsg(m.message || "Mining failed.");
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Join the node</p>
      <h1 className="mt-3 text-3xl font-black">Mine your first coin free.</h1>
      {inviter && <p className="mt-2 text-sm text-ink/60">Invited by @{inviter} (no strings attached)</p>}
      <p className="mt-3 text-sm text-ink/70">
        Pick a handle, tap once, and the node grinds a real puzzle proof for your first $PHY. Contributing
        is voluntary — you keep what you mine, and sending to others is always your choice.
      </p>
      {!done ? (
        <div className="mt-6 space-y-2">
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.toLowerCase())}
            placeholder="your handle e.g. sam_07"
            className="w-full rounded-xl border border-sky/30 bg-white px-4 py-3 text-center"
          />
          <button
            onClick={start}
            disabled={busy || !nickname}
            className="w-full rounded-full bg-forest px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {busy ? "Working…" : "Start mining"}
          </button>
          {msg && <p className="font-mono text-xs text-ink/60">{msg}</p>}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="font-mono text-xs text-ink/60">{msg}</p>
          <a href="/app/roadmap" className="block rounded-full bg-accent px-4 py-3 font-bold text-white">
            Open the Road →
          </a>
        </div>
      )}
    </main>
  );
}
