"use client";
import { useEffect, useState } from "react";

export default function MiningPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState<any>(null);
  const [wins, setWins] = useState<any[]>([]);

  async function loadRound() {
    try {
      const r = await fetch("/api/mining?round=current").then((x) => x.json());
      if (r.ok) setRound(r);
    } catch {}
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("physi_profile");
      const id = raw ? JSON.parse(raw)?.id : null;
      setUid(id);
      if (id) {
        fetch(`/api/mining?user_id=${encodeURIComponent(id)}`)
          .then((r) => r.json())
          .then((j) => j.ok && setWins(j.wins))
          .catch(() => {});
      }
    } catch {}
    loadRound();
    const iv = setInterval(loadRound, 15000);
    return () => clearInterval(iv);
  }, []);

  async function grind() {
    if (!uid) {
      setMsg("Create a handle on Profile first.");
      return;
    }
    setBusy(true);
    setMsg("Grinding proof for this round…");
    try {
      const r = await fetch("/api/mining", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: uid }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg(`Submitted! Round ${j.round} leader score: ${j.leader ? j.leader.score : "—"}.`);
        loadRound();
      } else {
        setMsg(j.message || "Grind failed.");
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
      <p className="mt-1 text-sm text-ink/70">
        One winner per round. Lowest grid score takes the coin — and fast rounds raise the bar.
      </p>
      {round && (
        <div className="mt-3 rounded-2xl border border-sky/30 bg-white p-4 font-mono text-xs">
          <p>
            Round {round.round} · {round.lattice_order}x{round.lattice_order} grid · bar {round.difficulty}
          </p>
          <p>
            closes in {Math.floor(round.ends_in_secs / 60)}m {round.ends_in_secs % 60}s
          </p>
          <p>Reward {round.reward} $PHY · Leader score {round.leader ? round.leader.score : "— none yet —"}</p>
        </div>
      )}
      <button
        onClick={grind}
        disabled={busy}
        className="mt-4 w-full rounded-full bg-forest px-4 py-3 font-bold text-white disabled:opacity-50"
      >
        {busy ? "Grinding…" : "Mine this round"}
      </button>
      {msg && <p className="mt-2 font-mono text-xs text-ink/70">{msg}</p>}
      <div className="mt-6 space-y-2">
        <p className="font-mono text-[11px] uppercase text-ink/50">Your round wins</p>
        {wins.map((w, i) => (
          <div key={i} className="rounded-xl border border-sky/20 bg-white p-3 font-mono text-xs">
            Round {w.round} · score {w.score} · +{w.reward}
          </div>
        ))}
        {wins.length === 0 && <p className="text-sm text-ink/50">No wins yet — grind above.</p>}
      </div>
    </div>
  );
}
