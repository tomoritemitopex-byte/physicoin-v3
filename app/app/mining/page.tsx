"use client";

import { useCallback, useEffect, useState } from "react";

type Round = { round: number; ends_in_secs: number; reward: number; leader: { score: number; ticket: string } | null; lattice_order: number; difficulty: number; status: string };
type Receipt = { round: number | null; reward: string; score: number; nonce: number; created_at: string };
type MiningStats = { accepted_proofs: number; total_rewards: string; best_score: number; rounds_won: number };

export default function MiningPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [session, setSession] = useState("");
  const [round, setRound] = useState<Round | null>(null);
  const [balance, setBalance] = useState("0");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [stats, setStats] = useState<MiningStats>({ accepted_proofs: 0, total_rewards: "0", best_score: 0, rounds_won: 0 });
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (id: string) => {
    setLoadError("");
    try {
      const [roundResponse, dashboardResponse] = await Promise.all([fetch("/api/mining?round=current", { cache: "no-store" }), fetch(`/api/mining?user_id=${encodeURIComponent(id)}`, { cache: "no-store" })]);
      const current = await roundResponse.json();
      const dashboard = await dashboardResponse.json();
      if (!roundResponse.ok || !current.ok) throw new Error("The active round is unavailable.");
      setRound(current); setSecondsLeft(current.ends_in_secs ?? 0);
      if (dashboard.ok) { setBalance(dashboard.balance ?? "0"); setReceipts(dashboard.receipts ?? []); setStats(dashboard.stats ?? stats); }
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Could not sync the mining dashboard."); } finally { setLoading(false); }
  }, [stats]);

  useEffect(() => {
    try {
      const profile = JSON.parse(localStorage.getItem("physi_profile") || "null"); const id = profile?.id || null; const token = localStorage.getItem("physi_session") || "";
      setUid(id); setSession(token);
      if (id) load(id).catch(() => undefined); else fetch("/api/mining?round=current", { cache: "no-store" }).then((r) => r.json()).then((current) => { if (current.ok) setRound(current); else setLoadError("The active round is unavailable."); }).catch(() => setLoadError("Could not load the active round.")).finally(() => setLoading(false));
    } catch { setLoading(false); setMessage("Create a wallet profile to start mining."); }
  }, [load]);

  useEffect(() => { const interval = setInterval(() => setSecondsLeft((value) => { if (value <= 1) { if (uid) load(uid).catch(() => undefined); return 0; } return value - 1; }), 1000); return () => clearInterval(interval); }, [load, uid]);
  useEffect(() => { if (!uid) return; const interval = setInterval(() => load(uid).catch(() => undefined), 15000); return () => clearInterval(interval); }, [load, uid]);

  async function mine() {
    if (!uid || !session) { setMessage("Unlock your wallet on Profile before mining."); return; }
    setBusy(true); setMessage("Searching nonce space for a verified proof...");
    try { const response = await fetch("/api/mining", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session}` }, body: JSON.stringify({ user_id: uid }) }); const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.message || "Proof batch exhausted."); setMessage(`Proof accepted for round ${result.round}. Receipt committed.`); await load(uid); } catch (error) { setMessage(error instanceof Error ? error.message : "Mining failed. Try again."); } finally { setBusy(false); }
  }

  const minutes = Math.floor(secondsLeft / 60); const seconds = String(secondsLeft % 60).padStart(2, "0"); const eligibility = round ? Math.min(100, Math.round((round.difficulty / 80) * 100)) : 0; const canMine = Boolean(uid && session && round && !busy);

  return <main className="mining-shell">
    <header className="topbar"><a href="/app" className="brand"><span className="brand-mark">P</span><span>PHYSICOIN</span></a><nav><a href="/app/mining" className="active">Mine</a><a href="/app/profile">Profile</a></nav><a href="/app/profile" className="wallet-chip"><span className="live-dot" />{Number(balance).toFixed(2)} <small>$PHY</small></a></header>
    <section className="hero"><div><p className="eyebrow"><span className="pulse-line" /> Proof-of-work network</p><h1>Make your mark<br /><em>in the lattice.</em></h1><p className="hero-copy">Compete for the lowest verified ticket in an open computational lottery. One proof. One round. A permanent receipt.</p></div><div className="hero-orbit" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core">{loading ? "…" : round ? round.round : "—"}<small>ROUND</small></div></div></section>
    <section className="dashboard-grid"><div className="round-card"><div className="card-head"><div><span className="eyebrow">Live round</span><h2>{loading ? "Syncing network" : round ? `Round ${round.round}` : "Round unavailable"}</h2></div><span className="status-tag"><span className="live-dot" />{loading ? "SYNCING" : round?.status || "OFFLINE"}</span></div><div className="metric-row"><Metric label="Closes in" value={`${minutes}:${seconds}`} accent /><Metric label="Reward" value={`${round?.reward ?? 1} $PHY`} /><Metric label="Lattice" value={round ? `${round.lattice_order} × ${round.lattice_order}` : "—"} /><Metric label="Leader" value={round?.leader ? String(round.leader.score) : "—"} /></div><div className="difficulty"><div className="difficulty-label"><span>Proof threshold</span><strong>{round?.difficulty ?? "—"}</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${eligibility}%` }} /></div><p>Your score must land at or below the threshold. Lowest verified ticket wins.</p></div>{loadError && <div className="error-box"><span>{loadError}</span>{uid && <button onClick={() => load(uid)}>Retry sync</button>}</div>}<button onClick={mine} disabled={!canMine} className="mine-button"><span className="button-symbol">↗</span>{busy ? "Searching nonce space..." : loading ? "Preparing round..." : !uid || !session ? "Unlock wallet to mine" : "Mine this round"}<span>→</span></button><p className="status-message" aria-live="polite">{message || (round ? "Ready when you are. Your next accepted proof earns a saved receipt." : "")}</p></div>
      <aside className="side-stack"><div className="stats-card"><span className="eyebrow">Your network record</span><div className="big-balance">{Number(balance).toFixed(2)} <small>$PHY</small></div><div className="stats-list"><Metric label="Accepted proofs" value={String(stats.accepted_proofs)} /><Metric label="Total earned" value={`${Number(stats.total_rewards).toFixed(2)} $PHY`} /><Metric label="Best score" value={stats.best_score ? String(stats.best_score) : "—"} /><Metric label="Rounds won" value={String(stats.rounds_won)} /></div></div><div className="how-card"><span className="eyebrow">Protocol / 03 steps</span><div className="step"><b>01</b><span>Server creates a round-specific challenge.</span></div><div className="step"><b>02</b><span>Nonce space searches for an eligible lattice.</span></div><div className="step"><b>03</b><span>Verifier recomputes your score and ticket.</span></div></div></aside></section>
    <section className="receipts-card"><div className="card-head"><div><span className="eyebrow">Immutable activity</span><h2>Mining receipts</h2></div><span className="receipt-count">{receipts.length} SAVED</span></div>{receipts.length ? <div className="receipt-list">{receipts.map((receipt, index) => <div className="receipt" key={`${receipt.created_at}-${index}`}><span className="receipt-round">{receipt.round ? `R${receipt.round}` : "CLAIM"}</span><span className="receipt-meta">nonce {receipt.nonce} · score {receipt.score}</span><span className="receipt-date">{new Date(receipt.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span><strong>+{receipt.reward} $PHY</strong></div>)}</div> : <div className="empty-receipts">No receipts yet. Your first accepted proof will appear here.</div>}</section>
  </main>;
}
function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className="metric"><span>{label}</span><strong className={accent ? "mint" : ""}>{value}</strong></div>; }
