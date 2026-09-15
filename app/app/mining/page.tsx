"use client";
import { useEffect, useState } from "react";

export default function MiningPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("physi_profile");
      const id = raw ? JSON.parse(raw)?.id : null;
      setUid(id);
      if (id) {
        fetch(`/api/mining?user_id=${encodeURIComponent(id)}`)
          .then((r) => r.json())
          .then((j) => j.ok && setLogs(j.logs))
          .catch(() => {});
      }
    } catch {}
  }, []);

  async function checkIn() {
    if (!uid) {
      setMsg("Create a handle on Profile first.");
      return;
    }
    setBusy(true);
    setMsg("Grinding puzzle proof…");
    try {
      const r = await fetch("/api/mining", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: uid }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg(`+${j.earned} $PHY · proof nonce ${j.proof.nonce}, score ${j.proof.score}`);
        setLogs([{ earned_amount: j.earned, proof_nonce: j.proof.nonce, proof_score: j.proof.score, created_at: new Date().toISOString() }, ...logs]);
      } else {
        setMsg(j.message || "Check-in failed.");
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 pb-24">
      <h1 className="text-xl font-black">Mining</h1>
      <p className="mt-1 text-sm text-ink/70">Daily check-in. Each claim grinds a fresh puzzle proof.</p>
      <button
        onClick={checkIn}
        disabled={busy}
        className="mt-4 w-full rounded-full bg-forest px-4 py-3 font-bold text-white disabled:opacity-50"
      >
        {busy ? "Mining…" : "Check in +$PHY"}
      </button>
      {msg && <p className="mt-2 font-mono text-xs text-ink/70">{msg}</p>}
      <div className="mt-6 space-y-2">
        {logs.map((l, i) => (
          <div key={i} className="rounded-xl border border-sky/20 bg-white p-3 font-mono text-xs">
            +{l.earned_amount} · nonce {l.proof_nonce} · score {l.proof_score} ·{" "}
            {String(l.created_at).slice(0, 10)}
          </div>
        ))}
      </div>
    </div>
  );
}
