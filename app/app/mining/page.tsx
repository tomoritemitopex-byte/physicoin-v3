"use client";

import { useCallback, useEffect, useState } from "react";

type Round = {
  round: number;
  ends_in_secs: number;
  reward: number;
  leader: { score: number; ticket: string } | null;
  lattice_order: number;
  difficulty: number;
  status: string;
};

type Receipt = {
  round: number | null;
  reward: string;
  score: number;
  nonce: number;
  created_at: string;
};

export default function MiningPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [session, setSession] = useState("");
  const [round, setRound] = useState<Round | null>(null);
  const [balance, setBalance] = useState("0");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (id: string) => {
    setLoadError("");
    try {
      const [roundResponse, dashboardResponse] = await Promise.all([
        fetch("/api/mining?round=current", { cache: "no-store" }),
        fetch(`/api/mining?user_id=${encodeURIComponent(id)}`, { cache: "no-store" }),
      ]);
      const current = await roundResponse.json();
      const dashboard = await dashboardResponse.json();
      if (!roundResponse.ok || !current.ok) throw new Error("The active round is unavailable.");
      setRound(current);
      if (dashboard.ok && dashboard.balance !== undefined) {
        setBalance(dashboard.balance);
        setReceipts(dashboard.receipts ?? []);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not sync the mining dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const profile = JSON.parse(localStorage.getItem("physi_profile") || "null");
      const id = profile?.id || null;
      const token = localStorage.getItem("physi_session") || "";
      setUid(id);
      setSession(token);
      if (id) load(id).catch(() => undefined);
      else {
        fetch("/api/mining?round=current", { cache: "no-store" })
          .then((response) => response.json())
          .then((current) => {
            if (current.ok) setRound(current);
            else setLoadError("The active round is unavailable.");
          })
          .catch(() => setLoadError("Could not load the active round."))
          .finally(() => setLoading(false));
      }
    } catch {
      setLoading(false);
      setMessage("Create a wallet profile to start mining.");
    }
  }, [load]);

  useEffect(() => {
    if (!uid) return;
    const interval = setInterval(() => load(uid).catch(() => undefined), 15000);
    return () => clearInterval(interval);
  }, [load, uid]);

  async function mine() {
    if (!uid || !session) {
      setMessage("Unlock your wallet on Profile before mining.");
      return;
    }
    setBusy(true);
    setMessage("Grinding a verified proof for this round...");
    try {
      const response = await fetch("/api/mining", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session}` },
        body: JSON.stringify({ user_id: uid }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "Proof batch exhausted.");
      setMessage(`Proof accepted for round ${result.round}. Your receipt is saved.`);
      await load(uid);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mining failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const minutes = round ? Math.floor(round.ends_in_secs / 60) : 0;
  const seconds = round ? String(round.ends_in_secs % 60).padStart(2, "0") : "00";
  const eligibility = round ? Math.min(100, Math.round((round.difficulty / 80) * 100)) : 0;
  const canMine = Boolean(uid && session && round && !busy);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 pb-28 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Proof-of-work demo</p>
          <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">Mine the open round.</h1>
          <p className="mt-2 max-w-xl text-sm text-ink/65">Find an eligible lattice, submit it to the verifier, and let the round lottery settle your reward on-chain.</p>
        </div>
        <div className="slip flex min-w-44 flex-col gap-1 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink/50">Wallet balance</span>
          <strong className="tnum text-3xl text-forest">{Number(balance).toFixed(2)} <span className="text-sm">$PHY</span></strong>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="slip flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50">Live lottery round</p>
              <h2 className="mt-1 text-2xl font-black">{loading ? "Syncing the open round" : round ? `Round ${round.round}` : "Round unavailable"}</h2>
            </div>
            <span className="rounded-full bg-sky-deep px-3 py-1 font-mono text-[11px] font-bold text-accent">{loading ? "syncing" : round?.status || "offline"}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Closes in" value={`${minutes}:${seconds}`} />
            <Stat label="Reward" value={`${round?.reward ?? 1} $PHY`} />
            <Stat label="Grid" value={`${round?.lattice_order ?? "-"} × ${round?.lattice_order ?? "-"}`} />
            <Stat label="Leader score" value={round?.leader ? String(round.leader.score) : "—"} />
          </div>
          <div className="rounded-xl border border-sky/30 bg-sky-deep/40 p-4">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-ink/60">
              <span>Eligibility bar</span><strong>{round?.difficulty ?? "-"}</strong>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${eligibility}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink/60">Your proof must score at or below the bar. Lowest verified ticket wins when the round closes.</p>
          </div>
          {loadError && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brick/20 bg-red-50 px-4 py-3 text-sm text-brick">
              <span>{loadError}</span>
              {uid && <button onClick={() => load(uid)} className="font-bold underline underline-offset-4">Retry sync</button>}
            </div>
          )}
          <button onClick={mine} disabled={!canMine} className="rounded-full bg-forest px-5 py-3.5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Grinding proof..." : loading ? "Preparing round..." : !uid || !session ? "Unlock wallet to mine" : "Mine this round"}
          </button>
          <p aria-live="polite" className="min-h-5 font-mono text-xs text-ink/65">{message || (round ? "Ready when you are. One accepted proof earns a saved receipt." : "")}</p>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="slip p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50">How it works</p>
            <ol className="mt-4 flex flex-col gap-4 text-sm text-ink/75">
              <li><strong className="text-ink">01</strong><span className="ml-3">The server creates a round-specific challenge.</span></li>
              <li><strong className="text-ink">02</strong><span className="ml-3">A small nonce batch searches for an eligible grid.</span></li>
              <li><strong className="text-ink">03</strong><span className="ml-3">The verifier recomputes your score and ticket.</span></li>
            </ol>
          </div>
          <div className="rounded-2xl border border-brick/20 bg-white/70 p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-brick">Wallet required</p>
            <p className="mt-2 text-sm text-ink/70">Mining receipts and balances are persisted only after the server accepts your wallet session.</p>
            <a href="/app/profile" className="mt-4 inline-block text-sm font-bold text-accent underline underline-offset-4">Open Profile</a>
          </div>
        </aside>
      </section>

      <section className="slip p-5 sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div><p className="font-mono text-[10px] uppercase tracking-widest text-ink/50">Mining receipts</p><h2 className="mt-1 text-2xl font-black">Your recent work</h2></div>
          <span className="font-mono text-xs text-ink/50">{receipts.length} saved</span>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {receipts.map((receipt, index) => (
            <div key={`${receipt.created_at}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky/20 bg-white/70 px-4 py-3 text-sm">
              <span className="font-mono text-xs text-ink/60">{receipt.round ? `Round ${receipt.round}` : "Daily claim"} · nonce {receipt.nonce}</span>
              <span className="font-mono text-xs">score {receipt.score}</span>
              <strong className="text-forest">+{receipt.reward} $PHY</strong>
            </div>
          ))}
          {receipts.length === 0 && <p className="rounded-xl border border-dashed border-ink/15 px-4 py-8 text-center text-sm text-ink/50">No receipts yet. Your first accepted proof will appear here.</p>}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-ink/10 bg-white/70 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">{label}</p><p className="tnum mt-1 text-lg font-black">{value}</p></div>;
}
