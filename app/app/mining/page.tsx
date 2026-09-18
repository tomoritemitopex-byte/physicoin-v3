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
  prev_hash: string;
};
type Receipt = { round: number | null; reward: string; score: number; nonce: number; created_at: string };
type MiningStats = { accepted_proofs: number; total_rewards: string; best_score: number; rounds_won: number };

function shortHex(h: string | null, len = 16): string {
  if (!h) return "—";
  if (h === "GENESIS") return "GENESIS";
  const s = h.toLowerCase();
  return s.length <= len ? s : `${s.slice(0, 8)}…${s.slice(-6)}`;
}
function fullShort(h: string | null): string {
  if (!h) return "—";
  if (h === "GENESIS") return "GENESIS";
  return h.slice(0, 12) + "…" + h.slice(-8);
}

function xpFrom(s: MiningStats): number {
  // Duo-style single XP: every entry counts, wins count more — feeds League.
  return s.accepted_proofs * 10 + s.rounds_won * 50;
}

function playJuice() {
  // Sound placeholder — Duo-style pop. Replace src with /sounds/pop.mp3 when asset lands.
  try {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.12;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    o.stop(ctx.currentTime + 0.24);
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {}
}

export default function MiningPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [session, setSession] = useState("");
  const [handle, setHandle] = useState("");
  const [round, setRound] = useState<Round | null>(null);
  const [balance, setBalance] = useState("0");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [stats, setStats] = useState<MiningStats>({ accepted_proofs: 0, total_rewards: "0", best_score: 0, rounds_won: 0 });
  const [yourTicket, setYourTicket] = useState<string | null>(null);
  const [submits, setSubmits] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [message, setMessage] = useState("");
  const [msgKind, setMsgKind] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [bounce, setBounce] = useState(false);

  const load = useCallback(
    async (id: string) => {
      setLoadError("");
      try {
        const [roundRes, dashRes] = await Promise.all([
          fetch("/api/mining?round=current", { cache: "no-store" }),
          fetch(`/api/mining?user_id=${encodeURIComponent(id)}`, { cache: "no-store" }),
        ]);
        const current = await roundRes.json();
        const dash = await dashRes.json();
        if (!roundRes.ok || !current.ok) throw new Error("The round is resting — retry in a few seconds.");
        setRound(current);
        setSecondsLeft(current.ends_in_secs ?? 0);
        if (dash.ok) {
          setBalance(dash.balance ?? "0");
          setReceipts(dash.receipts ?? []);
          setStats(dash.stats ?? { accepted_proofs: 0, total_rewards: "0", best_score: 0, rounds_won: 0 });
          setYourTicket(dash.current_ticket ?? null);
          setSubmits(dash.submits_this_round ?? 0);
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Could not sync.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem("physi_profile");
      const p = raw ? JSON.parse(raw) : null;
      const id = p?.id || null;
      const tok = localStorage.getItem("physi_session") || "";
      setUid(id);
      setSession(tok);
      setHandle(p?.nickname || "");
      if (id) load(id).catch(() => undefined);
      else
        fetch("/api/mining?round=current", { cache: "no-store" })
          .then((r) => r.json())
          .then((c) => {
            if (c.ok) {
              setRound(c);
              setSecondsLeft(c.ends_in_secs ?? 0);
            } else setLoadError("The round is resting.");
          })
          .catch(() => setLoadError("Could not load the round."))
          .finally(() => setLoading(false));
    } catch {
      setLoading(false);
      setMessage("Create a handle on Profile to start.");
    }
  }, [load]);

  useEffect(() => {
    const iv = setInterval(() => {
      setSecondsLeft((v) => {
        if (v <= 1) {
          if (uid) load(uid).catch(() => undefined);
          else
            fetch("/api/mining?round=current", { cache: "no-store" })
              .then((r) => r.json())
              .then((c) => {
                if (c.ok) setRound(c);
              })
              .catch(() => {});
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [load, uid]);
  useEffect(() => {
    if (!uid) return;
    const iv = setInterval(() => load(uid).catch(() => undefined), 15000);
    return () => clearInterval(iv);
  }, [load, uid]);

  async function mine() {
    if (!uid || !session) {
      setMsgKind("error");
      setMessage("Unlock your wallet on Profile first — we need your session to prove it’s you.");
      return;
    }
    if (submits >= 25) {
      setMsgKind("error");
      setMessage("Cap hit — 25 entries per round. Your tickets are locked in, next round in " + secondsLeft + "s.");
      return;
    }
    setBusy(true);
    setMsgKind("info");
    setMessage("Finding your best ticket…");
    try {
      const res = await fetch("/api/mining", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session}` },
        body: JSON.stringify({ user_id: uid }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        const code = j.code || "";
        if (code === "RATE_LIMITED") throw new Error("25/25 entries used this round — wait for the next round.");
        if (code === "BAD_PROOF" || code === "PROOF_BUDGET_EXHAUSTED" || j.message?.toLowerCase().includes("eligible")) {
          throw new Error("Not strong enough for this round — tap again, a new ticket is dealt each try.");
        }
        if (code === "ROUND_CLOSED") throw new Error("Round just closed — your next tap enters the fresh round.");
        if (code === "TOO_WEAK") throw new Error("Too weak for the bar — try again, luck resets every tap.");
        throw new Error(j.message || "No ticket this time — try again.");
      }
      setMsgKind("success");
      setMessage(`Locked in for round ${j.round ?? round?.round ?? "—"} — nice tap.`);
      setBounce(true);
      playJuice();
      setTimeout(() => setBounce(false), 650);
      await load(uid);
    } catch (e) {
      setMsgKind("error");
      setMessage(e instanceof Error ? e.message : "Mining failed. Tap again.");
    } finally {
      setBusy(false);
    }
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const xp = xpFrom(stats);
  const canMine = Boolean(uid && session && round && !busy && submits < 25);
  const barPct = round ? Math.min(100, Math.max(6, Math.round((1 - round.difficulty / 80) * 100))) : 0;

  return (
    <div className="min-h-screen bg-[#fffdf7] text-ink">
      {/* top bar — clean, billion-dollar minimal */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-[56px] max-w-[1120px] items-center justify-between px-4 sm:px-6">
          <a href="/app" className="font-display text-[17px] font-black tracking-tight">PhysiCoin</a>
          <nav className="hidden gap-6 text-[13px] font-semibold text-ink/60 sm:flex">
            <a href="/app/roadmap" className="hover:text-accent">Road</a>
            <a href="/app/schedule" className="hover:text-accent">Timetable</a>
            <a href="/app/mining" className="text-accent">Mine</a>
          </nav>
          <a href="/app/profile" className="rounded-full border border-ink/12 bg-white px-3.5 py-1.5 font-mono text-xs font-bold tabular-nums">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />
            {Number(balance).toFixed(2)} <span className="font-normal text-ink/50">$PHY</span>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-4 pb-10 pt-6 sm:px-6 sm:pt-8">
        {/* eyebrow + title — human language, no lattice/nonce */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent">One tap · one ticket · lowest wins</p>
            <h1 className="font-display mt-1 text-[34px] font-black leading-none tracking-tight sm:text-[40px]">
              Mine <span className="font-normal text-ink/35">· Round {loading ? "…" : round ? round.round : "—"}</span>
            </h1>
            <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-ink/60">
              Tap once — we grind 64 tickets behind the scenes and keep your best. <span className="font-semibold text-ink/80">Lower ticket wins</span> when the round closes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-sky/25 bg-white px-4 py-3 text-center shadow-sm">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">Your XP</p>
              <p className="font-display text-2xl font-black tabular-nums">{xp}</p>
              <p className="font-mono text-[10px] text-ink/45">→ feeds League</p>
            </div>
            <div className="hidden rounded-2xl bg-ink px-4 py-3 text-center text-white sm:block">
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/60">Streak</p>
              <p className="font-display text-[13px] font-bold">Protected</p>
              <p className="font-mono text-[10px] text-white/60">never wipes</p>
            </div>
          </div>
        </div>

        {/* ONE-GLANCE DASHBOARD — all six fields above the fold, no scroll needed */}
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="slip rounded-2xl p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">Round</p>
            <p className="font-display mt-1 text-3xl font-black tabular-nums">{loading ? "…" : round ? `#${round.round}` : "—"}</p>
            <p className="mt-1 font-mono text-[11px] text-ink/50">{round?.status === "open" ? "● Live" : loading ? "Syncing…" : "Closed"}</p>
          </div>
          <div className="slip rounded-2xl p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">Ends in</p>
            <p className={`font-display mt-1 text-3xl font-black tabular-nums ${secondsLeft <= 15 ? "text-brick" : "text-ink"}`}>
              {minutes}:{seconds}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink/50">{secondsLeft <= 15 ? "Closing — tap now" : `${submits}/25 entries used`}</p>
          </div>
          <div className="slip rounded-2xl p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">Bar to beat</p>
            <p className="font-display mt-1 text-2xl font-black tabular-nums">{round ? round.difficulty : "—"}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${barPct}%` }} />
            </div>
            <p className="mt-1 font-mono text-[10px] leading-none text-ink/50">Lower ticket wins — bar sets entry bar</p>
          </div>
          <div className="rounded-2xl border border-sky/30 bg-white p-4 shadow-sm">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">Your ticket</p>
            <p className="mt-1 truncate font-mono text-[13px] font-bold tabular-nums" title={yourTicket || undefined}>
              {yourTicket ? `0x${shortHex(yourTicket, 18)}` : "— no entry yet"}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink/50">{yourTicket ? "Lowest wins — tap to improve" : "Tap Mine to deal one"}</p>
          </div>
          <div className="rounded-2xl border border-sky/30 bg-white p-4 shadow-sm">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">Leader ticket</p>
            <p className="mt-1 truncate font-mono text-[13px] font-bold tabular-nums" title={round?.leader?.ticket || undefined}>
              {round?.leader?.ticket ? `0x${shortHex(round.leader.ticket, 18)}` : "— be first"}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink/50">{round?.leader ? "Current best — beat it" : "No leader yet"}</p>
          </div>
          <div className="rounded-2xl border border-sky/30 bg-white p-4 shadow-sm">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">Last round code</p>
            <p className="mt-1 truncate font-mono text-[12px] font-bold tabular-nums" title={round?.prev_hash || undefined}>
              {round?.prev_hash ? shortHex(round.prev_hash, 22) : "GENESIS"}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-none text-ink/50">Chain of winners — verifiable</p>
          </div>
        </section>

        {/* ACTION — Duo gamification: bounce + juice + XP + streak protection */}
        <section className={`slip mt-4 rounded-[20px] p-5 sm:p-6 ${bounce ? "mine-bounce" : ""}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-display text-[18px] font-black tracking-tight">Tap to mine</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink/60">
                We deal 64 behind the tap and keep your best. <span className="font-semibold text-ink/80">+10 XP per entry</span>, +50 on a win — XP feeds the League.
              </p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-700">
                <span>🛡️</span> Streak protected — miss a day, XP stays. Hit 3 days for shield.
              </p>
            </div>
            <div className="shrink-0 sm:w-[340px]">
              <button
                onClick={mine}
                disabled={!canMine}
                className={`flex w-full items-center justify-center gap-3 rounded-full px-6 py-4 text-[15px] font-black transition ${canMine ? "bg-ink text-white hover:bg-accent hover:shadow-lg active:scale-[0.98]" : "cursor-not-allowed bg-ink/10 text-ink/40"}`}
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-sm">⛏</span>
                {busy ? "Dealing…" : loading ? "Syncing…" : !uid ? "Create handle to mine" : !session ? "Unlock wallet to mine" : submits >= 25 ? "Cap reached (25/25)" : "Mine this round"}
                <span aria-hidden>→</span>
              </button>
              <p className="mt-2 text-center font-mono text-[11px] text-ink/45">
                {handle ? `@${handle}` : "No handle"} · {submits}/25 entries · 1 $PHY reward
              </p>
            </div>
          </div>
          {/* status — clear BAD_PROOF / TOO_WEAK handling */}
          <div
            className={`mt-4 rounded-xl border px-3 py-2.5 font-mono text-[12px] leading-relaxed ${msgKind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : msgKind === "error" ? "border-brick/20 bg-brick/5 text-brick" : "border-sky/20 bg-sky/5 text-ink/60"}`}
            aria-live="polite"
          >
            {message || (round ? "Ready — one tap enters you. Lowest ticket at close takes the coin." : "Syncing the round…")}
          </div>
          {loadError && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-brick/20 bg-brick/5 px-3 py-2 font-mono text-xs text-brick">
              <span>{loadError}</span>
              {uid && (
                <button onClick={() => load(uid)} className="font-bold underline">
                  Retry
                </button>
              )}
            </div>
          )}
          {/* sound placeholder note + tiny league preview */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink/8 pt-3 font-mono text-[11px] text-ink/50">
            <span>🔊 pop on success — sound placeholder (swap in /sounds/pop.mp3)</span>
            <span className="tabular-nums">
              {stats.accepted_proofs} entries · {stats.rounds_won} wins · {Number(stats.total_rewards).toFixed(2)} $PHY earned
            </span>
          </div>
        </section>

        {/* receipts — below the fold, does not affect one-glance requirement */}
        <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[18px] font-black tracking-tight">Receipts</h2>
            <span className="rounded-full bg-ink px-2.5 py-1 font-mono text-[10px] font-bold text-white">{receipts.length} saved</span>
          </div>
          {receipts.length ? (
            <div className="mt-4 divide-y divide-ink/8">
              {receipts.map((r, i) => (
                <div key={`${r.created_at}-${i}`} className="flex items-center justify-between gap-3 py-2.5 font-mono text-xs">
                  <span className="font-bold text-accent">{r.round ? `R${r.round}` : "CLAIM"}</span>
                  <span className="hidden text-ink/50 sm:inline">entry {r.nonce} · score {r.score}</span>
                  <span className="text-ink/50">{new Date(r.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  <strong className="text-emerald-700">+{r.reward} $PHY</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-ink/15 bg-paper px-4 py-6 text-center font-mono text-xs text-ink/50">
              No receipts yet — your first tap that clears the bar lands here.
            </p>
          )}
        </section>

        <p className="mt-6 text-center font-mono text-[11px] text-ink/40">
          Human copy only — no lattice / nonce jargon. Ticket math recomputes on the server every submit.
        </p>
      </main>

      <style>{`@keyframes mine-bounce{0%{transform:scale(1)}25%{transform:scale(1.015)}50%{transform:scale(0.99)}100%{transform:scale(1)}} .mine-bounce{animation:mine-bounce 560ms cubic-bezier(.2,.8,.2,1)}`}</style>
    </div>
  );
}
