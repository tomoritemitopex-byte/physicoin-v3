"use client";

import { useCallback, useEffect, useState } from "react";
import QuizPost from "@/components/road/QuizPost";

type Slip = {
  id: string;
  title: string;
  venue: string;
  event_date: string;
  event_time: string;
  status: string;
  severity?: string;
  scope_type?: string;
  scope_value?: string | null;
  created_at?: string;
};

type CurrentRound = {
  round: number;
  ends_in_secs: number;
  reward: number;
  leader: { user_id?: string; score: number; ticket: string } | null;
  status: string;
  lattice_order: number;
  difficulty: number;
  prev_hash: string;
};

type BlockRow = {
  number: number;
  status: string;
  winning_score: number | null;
  winning_ticket?: string | null;
  winner: string | null;
  reward?: string;
  tx_count?: number | null;
  tx_root?: string | null;
  prev_hash?: string | null;
};

type Schedule = {
  version: number | null;
  lattice_order?: number;
  score?: number;
  winner?: string | null;
  ticket?: string;
  cells?: { row: number; col: number; hall: string; period: string; programme: string; level: string }[];
};

type Leader = { nickname: string; wins: number; earned: string; best_score: number };

function shortHex(h: string | null | undefined, head = 8, tail = 6): string {
  if (!h) return "—";
  if (h === "GENESIS") return "GENESIS";
  const s = String(h).toLowerCase();
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function fmtTimeLeft(s: number): string {
  const m = Math.floor(Math.max(0, s) / 60);
  const sec = String(Math.max(0, s) % 60).padStart(2, "0");
  return `${m}:${sec}`;
}
function boardXp(s: { accepted_proofs: number; rounds_won: number } | null): number {
  if (!s) return 0;
  return s.accepted_proofs * 10 + s.rounds_won * 50;
}
function maxScoreForOrderBoard(n: number): number {
  return 4 * n * (n - 1) + n * n - 1;
}
function barCapBoard(order: number): number {
  return Math.max(8, Math.floor(maxScoreForOrderBoard(order) / 6));
}

const CHAIN_CACHE_KEY = "physi_chain_cache_v3";
const HEAT_BOOST_KEY = "physi_heat_boost";
const ALIAS_CACHE_KEY = "physi_alias_cache_v3";
const GROWTH_CACHE_KEY = "physi_growth_pulse_cache_v3";
type AliasRow = { id: string; alias: string; canonical: string; votes_yes: number; votes_no: number; status: string };
const BUILDING_CODES = ["ANAT","PHYSIOL","BIOCHEM","MBBS","PHARM","COMM MED","NURS","BMLS"] as const;
const BUILDING_IDS = ["anat","phys","biochem","mbbs","pharm","commed","nursing","lab"] as const;
const BUILDING_LABEL: Record<string,string> = { anat:"ANAT", phys:"PHYSIOL", biochem:"BIOCHEM", mbbs:"MBBS", pharm:"PHARM", commed:"COMM MED", nursing:"NURS", lab:"BMLS" };

/* Hall heat sparkline — Bend spec, TS runtime.
   Bend spec in bend/Emit.bend (hall_heat: count*2, parallel per-hall) is the
   parallel specification, verified via `bend --check-only`; TS below is the
   runtime. `bend build` emits a runnable program, not an importable library,
   so this JS is authoritative — additive, no new tables. */
function heatFromSlips(slips: Slip[]): { heat: Record<string,number>, hottest: string|null, max: number } {
  const heat: Record<string, number> = {};
  for (const id of BUILDING_IDS) heat[id]=0;
  for (const s of slips) {
    const hay = `${s.title} ${s.venue}`.toLowerCase();
    for (let i=0;i<BUILDING_CODES.length;i++) {
      if (hay.includes(BUILDING_CODES[i].toLowerCase())) { heat[BUILDING_IDS[i]]++; break; }
    }
  }
  let max=0; let hottest: string|null=null;
  for (const id of BUILDING_IDS) if (heat[id]>max) { max=heat[id]; hottest=id; }
  if (max===0) hottest=null;
  return { heat, hottest, max };
}

/* sparkline: tiny SVG + mini timeline — no DB, purely tx_counts
   Bend spec in bend/Emit.bend / UI.bend (parallel grid_cells) is the
   specification; TS below is the runtime (Array.map sequential placeholder,
   additive, no new tables). Bend verified via `bend --check-only`. */
function ChainSparkline({ blocks, loading }: { blocks: BlockRow[]; loading: boolean }) {
  const last5 = blocks.slice(0, 5);
  // chronological left->right = oldest to newest
  // NOTE: Bend spec (UI.bend grid_cells) is the parallel specification;
  // TS Array.map below is the runtime — additive, no new tables.
  const ordered = [...last5].reverse();
  const counts = ordered.map((b) => Math.max(0, b.tx_count ?? 0));
  const max = Math.max(1, ...counts, 1);
  // SVG coords: width 100, height 28, padding 2
  const w = 100, h = 28, pad = 2;
  const step = ordered.length > 1 ? (w - pad * 2) / (ordered.length - 1) : w - pad * 2;
  const points = counts.map((c, i) => {
    const x = pad + i * step;
    const y = h - pad - (c / max) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const area = counts.length > 1 ? `${pad},${h - pad} ${points} ${pad + (counts.length - 1) * step},${h - pad}` : "";
  const isMoving = counts.some((c) => c > 0) || ordered.some((b) => b.status === "closed");
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-sky/25 bg-white px-3 py-2.5 shadow-sm sm:px-4">
      <div className="shrink-0">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/40">Chain pulse · last 5</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${isMoving && !loading ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,.6)]" : "bg-ink/20"} ${isMoving && !loading ? "animate-pulse" : ""}`} aria-hidden />
          <span className="font-mono text-xs font-bold tabular-nums text-ink">{loading ? "syncing…" : isMoving ? "moving" : "idle · genesis"}</span>
          <span className="font-mono text-[11px] text-ink/40">tx/block</span>
        </div>
      </div>
      <div className="hidden h-9 w-px shrink-0 bg-sky/20 sm:block" aria-hidden />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-[120px] shrink-0 sm:w-[160px]" preserveAspectRatio="none" aria-hidden>
          {area && <polygon points={area} fill="rgba(125,211,252,0.22)" stroke="none" />}
          {points && <polyline points={points} fill="none" stroke="#0369a1" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />}
          {counts.map((c, i) => {
            const x = pad + i * step;
            const y = h - pad - (c / max) * (h - pad * 2);
            return <circle key={i} cx={x} cy={y} r={counts.length === 1 ? 2.5 : 2} fill={c > 0 ? "#0369a1" : "#cbd5e1"} stroke="white" strokeWidth={0.9} />;
          })}
        </svg>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {loading ? (
            <span className="font-mono text-[11px] text-ink/40">…</span>
          ) : ordered.length === 0 ? (
            <span className="font-mono text-[11px] text-ink/40">no blocks yet — mine to start</span>
          ) : (
            ordered.map((b, i) => (
              <span key={b.number} className="flex items-center gap-1">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[10px] font-bold tabular-nums ${b.status === "closed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-sky/20 bg-sky/10 text-ink/60"}`} title={`#${b.number} · ${b.tx_count ?? 0} txs · ${shortHex(b.prev_hash, 6, 4)} → ${shortHex((b as any).winning_ticket, 6, 4)}`}>
                  #{b.number}·{b.tx_count ?? 0}
                </span>
                {i < ordered.length - 1 && <span className="font-mono text-[10px] text-accent/50">→</span>}
              </span>
            ))
          )}
        </div>
      </div>
      <a href="/app/rounds" className="hidden shrink-0 rounded-full border border-ink/10 bg-ink px-3 py-1.5 font-mono text-[11px] font-bold text-white hover:bg-accent sm:inline-flex">View chain →</a>
    </div>
  );
}

/* Growth Pulse — exit-metrics one-glance card
   Offline-first, additive, no new tables.
   Fetches /api/stats (7d wallets + slips) + /api/telemetry (tx_count windows).
   - green "Compounding — invite now" when new wallets >5 and win rate >30%
   - amber "Saturated — consider listing" when tx_count==0 for 3 rounds */
function GrowthPulse() {
  const [loading, setLoading] = useState(true);
  const [newWallets, setNewWallets] = useState<number | null>(null);
  const [slips7d, setSlips7d] = useState<number | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [saturated, setSaturated] = useState(false);
  const [degraded, setDegraded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // offline cache first — one-glance even without network
    try {
      const raw = localStorage.getItem(GROWTH_CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw);
        if (typeof c.newWallets === "number") setNewWallets(c.newWallets);
        if (typeof c.slips7d === "number") setSlips7d(c.slips7d);
        if (typeof c.winRate === "number") setWinRate(c.winRate);
        if (typeof c.saturated === "boolean") setSaturated(c.saturated);
      }
    } catch {}
    try {
      const [sRes, tRes] = await Promise.all([
        fetch("/api/stats", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/telemetry?limit=7", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      let nw: number | null = null;
      let sp: number | null = null;
      let degradedFlag = false;
      if (sRes) {
        if (sRes.ok) {
          nw = Number(sRes.users_7d ?? sRes.users_new_7d ?? 0);
          sp = Number(sRes.events_7d ?? sRes.events_new_7d ?? sRes.events ?? 0);
          degradedFlag = !!sRes.degraded;
          if (Number.isNaN(nw)) nw = 0;
          if (Number.isNaN(sp)) sp = 0;
        } else if (sRes.code === "DB_NOT_CONFIGURED") degradedFlag = true;
      }
      // telemetry win rate + saturated
      let wr: number | null = null;
      let sat = false;
      if (tRes && tRes.ok) {
        const rounds: any[] = tRes.recentRounds || tRes.rounds || [];
        // win rate = share of rounds with tx_count>0 (last 7)
        const window = rounds.slice(0, 7);
        if (window.length > 0) {
          const wins = window.filter((r: any) => Number(r.tx_count ?? 0) > 0).length;
          wr = Math.round((wins / window.length) * 100);
        } else {
          wr = 0;
        }
        // saturated: flag from server or 3 consecutive tx_count==0
        if (tRes.flags?.SATURATED) sat = true;
        else {
          const asc = [...window].sort((a: any, b: any) => a.round - b.round);
          for (let i = 0; i + 2 < asc.length; i++) {
            const w = asc.slice(i, i + 3);
            if (w[1].round !== w[0].round + 1 || w[2].round !== w[1].round + 1) continue;
            if (w.every((r: any) => Number(r.tx_count ?? 0) === 0)) { sat = true; break; }
          }
          // also simple last-3 check chronological newest
          if (!sat && window.length >= 3) {
            const last3 = window.slice(0, 3);
            if (last3.every((r: any) => Number(r.tx_count ?? 0) === 0)) sat = true;
          }
        }
        if (tRes.degraded) degradedFlag = true;
      }
      if (nw !== null) setNewWallets(nw);
      if (sp !== null) setSlips7d(sp);
      if (wr !== null) setWinRate(wr);
      setSaturated(sat);
      setDegraded(degradedFlag);
      try {
        const toCache: any = {};
        if (nw !== null) toCache.newWallets = nw;
        if (sp !== null) toCache.slips7d = sp;
        if (wr !== null) toCache.winRate = wr;
        toCache.saturated = sat;
        toCache.ts = Date.now();
        if (Object.keys(toCache).length > 1) localStorage.setItem(GROWTH_CACHE_KEY, JSON.stringify(toCache));
      } catch {}
    } catch {
      // keep cached values
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const compounding = !saturated && (newWallets ?? 0) > 5 && (winRate ?? 0) > 30;
  const status = saturated
    ? { label: "Saturated — consider listing", dot: "bg-amber-500", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" }
    : compounding
    ? { label: "Compounding — invite now", dot: "bg-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" }
    : { label: "Steady — keep building", dot: "bg-sky", bg: "bg-sky/10", border: "border-sky/20", text: "text-ink/70" };

  return (
    <div className={`mt-3 rounded-2xl border ${status.border} ${status.bg} px-3 py-3 shadow-sm sm:px-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/50">Growth Pulse · 7d</span>
          {degraded && <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[10px] text-ink/50">cached</span>}
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border ${status.border} bg-white px-2.5 py-1 font-mono text-[11px] font-bold ${status.text}`}>
          <span className={`h-2 w-2 rounded-full ${status.dot} ${saturated || compounding ? "animate-pulse" : ""}`} aria-hidden />
          {status.label}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white px-2.5 py-2 text-center shadow-sm sm:px-3">
          <p className="font-mono text-[9px] uppercase tracking-widest text-ink/40">New wallets</p>
          <p className="font-mono text-[15px] font-black tabular-nums text-ink">{loading && newWallets === null ? "…" : String(newWallets ?? 0)}</p>
        </div>
        <div className="rounded-xl bg-white px-2.5 py-2 text-center shadow-sm sm:px-3">
          <p className="font-mono text-[9px] uppercase tracking-widest text-ink/40">Slips posted</p>
          <p className="font-mono text-[15px] font-black tabular-nums text-ink">{loading && slips7d === null ? "…" : String(slips7d ?? 0)}</p>
        </div>
        <div className="rounded-xl bg-white px-2.5 py-2 text-center shadow-sm sm:px-3">
          <p className="font-mono text-[9px] uppercase tracking-widest text-ink/40">Win rate</p>
          <p className="font-mono text-[15px] font-black tabular-nums text-ink">{loading && winRate === null ? "…" : `${winRate ?? 0}%`}</p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 font-mono text-[10px] leading-none">
        <span className="text-ink/40">invite drives wallets · slips drive tx · wins drive chain</span>
        <button onClick={load} className="font-bold text-ink/40 hover:text-ink">↻ refresh</button>
      </div>
    </div>
  );
}

export default function BoardPage() {
  // ── identity ──
  const [uid, setUid] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [session, setSession] = useState("");

  // ── mempool ──
  const [slips, setSlips] = useState<Slip[]>([]);
  const [slipsLoading, setSlipsLoading] = useState(true);
  const [slipsError, setSlipsError] = useState("");
  // Conversational flow lives in QuizPost (components/road/QuizPost.tsx) — one glance, no legacy form state.

  // ── mining ──
  const [round, setRound] = useState<CurrentRound | null>(null);
  const [roundLoading, setRoundLoading] = useState(true);
  const [roundError, setRoundError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [mineBusy, setMineBusy] = useState(false);
  const [mineMsg, setMineMsg] = useState("");
  const [mineKind, setMineKind] = useState<"idle" | "success" | "error">("idle");

  // ── chain ──
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [chainLoading, setChainLoading] = useState(true);
  const [chainError, setChainError] = useState("");

  // ── leaders ──
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(true);

  // ── earning preview (XP from mining dash, no new DB) ──
  const [xpStats, setXpStats] = useState<{ accepted_proofs: number; rounds_won: number; total_rewards: string } | null>(null);
  // Heat Hall
  const [boostHall, setBoostHall] = useState<string | null>(null);
  const [heatToast, setHeatToast] = useState("");
  const [serverHeat, setServerHeat] = useState<Record<string,number> | null>(null);
  // Name votes strip (hall alias disputes)
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [aliasLoading, setAliasLoading] = useState(true);
  const [aliasBusy, setAliasBusy] = useState<string | null>(null);
  const [aliasMsg, setAliasMsg] = useState("");

  // identity once
  useEffect(() => {
    try {
      const raw = localStorage.getItem("physi_profile");
      const p = raw ? JSON.parse(raw) : null;
      setUid(p?.id || null);
      setHandle(p?.nickname || "");
      setSession(localStorage.getItem("physi_session") || "");
    } catch {}
  }, []);

  // fetches
  const loadSlips = useCallback(async () => {
    setSlipsLoading(true);
    setSlipsError("");
    try {
      const r = await fetch("/api/timetable?status=pending&limit=5", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.message || "Could not load slips.");
      setSlips((j.events || []).slice(0, 5));
    } catch (e) {
      setSlipsError(e instanceof Error ? e.message : "Could not load slips.");
    } finally {
      setSlipsLoading(false);
    }
  }, []);

  const loadRound = useCallback(async () => {
    setRoundLoading(true);
    setRoundError("");
    try {
      const r = await fetch("/api/mining?round=current", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.message || "Round is resting.");
      setRound(j as CurrentRound);
      setSecondsLeft(j.ends_in_secs ?? 0);
    } catch (e) {
      setRoundError(e instanceof Error ? e.message : "Could not load round.");
    } finally {
      setRoundLoading(false);
    }
  }, []);

  const loadChain = useCallback(async () => {
    setChainLoading(true);
    setChainError("");
    // offline graceful: start from cache so sparkline shows immediately
    try {
      const cachedRaw = localStorage.getItem(CHAIN_CACHE_KEY);
      if (cachedRaw) {
        const c = JSON.parse(cachedRaw);
        if (Array.isArray(c?.blocks) && c.blocks.length > 0) setBlocks(c.blocks);
        if (c?.schedule) setSchedule(c.schedule);
      }
    } catch {}
    try {
      const [rr, ss] = await Promise.all([
        fetch("/api/rounds?limit=5", { cache: "no-store" }).then((x) => x.json()),
        fetch("/api/schedule", { cache: "no-store" }).then((x) => x.json()),
      ]);
      if (rr.ok && Array.isArray(rr.rounds)) {
        const base: BlockRow[] = rr.rounds.slice(0, 5);
        // enrich last 3 with tx_count/ticket via per-round fetch (graceful fallback if not present)
        const enriched = await Promise.all(
          base.slice(0, 3).map(async (b: BlockRow) => {
            try {
              const one = await fetch(`/api/rounds?round=${b.number}`, { cache: "no-store" }).then((x) => x.json());
              if (one.ok && one.block) {
                return {
                  ...b,
                  winning_ticket: one.block.winning_ticket ?? (b as any).winning_ticket ?? null,
                  tx_count: one.block.tx_count ?? (b as any).tx_count ?? null,
                  tx_root: one.block.tx_root ?? null,
                  prev_hash: one.block.prev_hash ?? null,
                } as BlockRow;
              }
            } catch {}
            return b;
          })
        );
        // keep cap at 3 for right column but store all 5 for count
        const rest = base.slice(3);
        const all = [...enriched, ...rest] as BlockRow[];
        setBlocks(all);
        let sched: Schedule | null = null;
        if (ss.ok) {
          const s: Schedule = ss.version !== undefined ? ss : ss.schedule || ss;
          setSchedule(s);
          sched = s;
        } else {
          setSchedule(ss.version !== undefined ? ss : null);
          sched = ss.version !== undefined ? ss : null;
        }
        try { localStorage.setItem(CHAIN_CACHE_KEY, JSON.stringify({ blocks: all, schedule: sched, ts: Date.now() })); } catch {}
      } else if (!rr.ok) {
        throw new Error(rr.message || "Could not load chain.");
      } else {
        if (ss.ok) {
          const s: Schedule = ss.version !== undefined ? ss : ss.schedule || ss;
          setSchedule(s);
        }
      }
    } catch (e) {
      // offline cache graceful: if we have cached blocks keep them visible with soft error
      try {
        const cachedRaw = localStorage.getItem(CHAIN_CACHE_KEY);
        if (cachedRaw) {
          const c = JSON.parse(cachedRaw);
          if (Array.isArray(c?.blocks) && c.blocks.length > 0) {
            setBlocks(c.blocks);
            if (c.schedule) setSchedule(c.schedule);
            setChainError(`${e instanceof Error ? e.message : "Could not load chain."} — showing cached chain.`);
            return;
          }
        }
      } catch {}
      setChainError(e instanceof Error ? e.message : "Could not load chain.");
    } finally {
      setChainLoading(false);
    }
  }, []);

  const loadLeaders = useCallback(async () => {
    setLeadersLoading(true);
    try {
      const r = await fetch("/api/rounds?view=leaders&limit=5", { cache: "no-store" });
      const j = await r.json();
      if (j.ok && Array.isArray(j.leaders)) setLeaders(j.leaders.slice(0, 5));
    } catch {}
    finally {
      setLeadersLoading(false);
    }
  }, []);

  const loadAliases = useCallback(async () => {
    setAliasLoading(true);
    try {
      const cached = localStorage.getItem(ALIAS_CACHE_KEY);
      if (cached) {
        const c = JSON.parse(cached);
        if (Array.isArray(c?.proposals)) {
          const top = (c.proposals as AliasRow[]).slice(0, 3);
          if (top.length) setAliases(top);
        }
      }
    } catch {}
    try {
      const r = await fetch("/api/halls/alias?status=pending", { cache: "no-store" });
      const j = await r.json();
      if (j.ok && Array.isArray(j.proposals)) {
        const top = (j.proposals as AliasRow[]).slice(0, 3);
        setAliases(top);
        try { localStorage.setItem(ALIAS_CACHE_KEY, JSON.stringify({ proposals: j.proposals, ts: Date.now() })); } catch {}
      }
    } catch {}
    finally { setAliasLoading(false); }
  }, []);

  async function voteAlias(row: AliasRow) {
    if (!uid || !session) {
      setAliasMsg("Unlock your wallet on Profile — we need your session to vote.");
      return;
    }
    setAliasBusy(row.id);
    setAliasMsg("");
    try {
      const headers: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${session}` };
      const r = await fetch("/api/halls/alias", {
        method: "POST",
        headers,
        body: JSON.stringify({ alias_name: row.alias, canonical_name: row.canonical, voter_id: uid, vote: "yes", token: session }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        if (j.code === "RATE_LIMITED" || j.message?.includes("25")) throw new Error("25/25 used this round — wait for next.");
        throw new Error(j.message || "Vote failed.");
      }
      setAliasMsg(`Voted yes for ${row.alias} → ${row.canonical}`);
      await loadAliases();
      // refresh heat so alias contribution moves Heat Hall instantly
      fetch("/api/halls/heat", { cache: "no-store" }).then((x)=>x.json()).then((j2)=>{ if(j2.ok) setServerHeat(j2.heat || j2); }).catch(()=>{});
    } catch (e) {
      setAliasMsg(e instanceof Error ? e.message : "Vote failed.");
    } finally { setAliasBusy(null); }
  }

  useEffect(() => {
    loadSlips();
    loadRound();
    loadChain();
    loadLeaders();
    loadAliases();
    // Heat Hall fetch (offline-first uses slips fallback)
    fetch("/api/halls/heat", { cache: "no-store" }).then((r)=>r.json()).then((j)=>{ if(j.ok&&j.heat) setServerHeat(j.heat); }).catch(()=>{});
    try {
      const b = localStorage.getItem(HEAT_BOOST_KEY);
      if (b) {
        const p = JSON.parse(b);
        if (p?.buildingId && Date.now() - (p.ts||0) < 10*60*1000) setBoostHall(p.buildingId);
        else localStorage.removeItem(HEAT_BOOST_KEY);
      }
    } catch {}
    // XP for earning preview (no new DB, existing mining dash)
    try {
      const raw = localStorage.getItem("physi_profile");
      const p = raw ? JSON.parse(raw) : null;
      if (p?.id) {
        fetch(`/api/mining?user_id=${encodeURIComponent(p.id)}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((j) => {
            if (j.ok && j.stats) setXpStats(j.stats);
          })
          .catch(() => {});
      }
    } catch {}
  }, [loadSlips, loadRound, loadChain, loadLeaders, loadAliases]);

  // countdown
  useEffect(() => {
    const iv = setInterval(() => {
      setSecondsLeft((v) => {
        if (v <= 1) {
          loadRound().catch(() => {});
          loadChain().catch(() => {});
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [loadRound, loadChain]);

  // refresh identity when session changes externally (profile page)
  useEffect(() => {
    const onFocus = () => {
      try {
        const tok = localStorage.getItem("physi_session") || "";
        setSession(tok);
        const raw = localStorage.getItem("physi_profile");
        const p = raw ? JSON.parse(raw) : null;
        setUid(p?.id || null);
        setHandle(p?.nickname || "");
      } catch {}
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // ── actions ── (posting now via QuizPost 3-step conversational flow — see components/road/QuizPost.tsx)
  async function mine() {
    if (!uid || !session) {
      setMineKind("error");
      setMineMsg("Unlock your wallet on Profile — we need your session to prove it’s you.");
      return;
    }
    setMineBusy(true);
    setMineKind("idle");
    setMineMsg("Dealing your ticket… (64 tries behind the tap)");
    try {
      const r = await fetch("/api/mining", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session}` },
        body: JSON.stringify({ user_id: uid }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        const code = j.code || "";
        if (code === "RATE_LIMITED") throw new Error("25/25 used this round — wait for the next round.");
        if (code === "PROOF_BUDGET_EXHAUSTED" || j.message?.toLowerCase().includes("eligible")) {
          throw new Error("No ticket strong enough this tap — try again, new deal each time.");
        }
        if (code === "ROUND_CLOSED") throw new Error("Round just closed — your next tap enters the fresh round.");
        throw new Error(j.message || "No ticket this time — tap again.");
      }
      setMineKind("success");
      const boostLabel = boostHall ? (BUILDING_LABEL[boostHall] || boostHall) : null;
      if (boostLabel) {
        setMineMsg(`Locked in for round ${j.round ?? round?.round ?? "—"} — lowest ticket wins at close. (×1.5 boost for ${boostLabel} applied — next ticket)`);
        try { localStorage.removeItem(HEAT_BOOST_KEY); } catch {}
        setBoostHall(null);
      } else {
        setMineMsg(`Locked in for round ${j.round ?? round?.round ?? "—"} — lowest ticket wins at close.`);
      }
      await loadRound();
      await loadLeaders();
    } catch (e) {
      setMineKind("error");
      setMineMsg(e instanceof Error ? e.message : "Mining failed — tap again.");
    } finally {
      setMineBusy(false);
    }
  }

  const barPct = round ? Math.min(100, Math.max(8, Math.round((1 - round.difficulty / 80) * 100))) : 0;
  const xp = boardXp(xpStats);
  const level = Math.max(1, Math.floor(xp / 100) + 1);
  const xpBonusBoard = Math.min(0.5, Math.floor(xp / 100) * 0.05);
  const streakBonusBoard = (xpStats?.rounds_won || 0) >= 3 ? 0.15 : (xpStats?.rounds_won || 0) >= 1 ? 0.1 : 0;
  const barBonusBoard = round ? Math.min(0.12, Math.max(0, (barCapBoard(round.lattice_order) - round.difficulty) * 0.02)) : 0;
  const totalPreviewBoard = (1 + xpBonusBoard + streakBonusBoard + barBonusBoard).toFixed(2);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky/30 via-[#f0fbff] to-white pb-16 text-ink">
      {/* sky header ruled */}
      <div className="mx-auto max-w-[1120px] px-4 pt-6 sm:px-6">
        {/* eyebrow */}
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Timetable + Mining · one board</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-[30px] font-black leading-none tracking-tight sm:text-[36px]">
            Board <span className="font-normal text-ink/35">· fused</span>
          </h1>
          <p className="max-w-[560px] text-[13px] leading-relaxed text-ink/60">
            Post a notice → it sits in the mempool → miners lottery it in → a block locks it with <span className="font-mono text-[11px]">prev_hash</span> + <span className="font-mono text-[11px]">tx_root</span> → chain.
            <span className="ml-1 font-semibold text-ink/80">No new coin, no new post — same products, one view.</span>
          </p>
        </div>

        {/* CHAIN PULSE — sparkline (last 5 blocks' tx_counts) — visible without opening /app/rounds */}
        <div className="mt-4">
          <ChainSparkline blocks={blocks} loading={chainLoading} />
          {chainError && blocks.length > 0 && <p className="mt-1 font-mono text-[11px] text-amber-700">{chainError}</p>}
        </div>
        {/* HEAT HALL — one-glance pending heat
            Bend spec (bend/Emit.bend hall_heat: count*2) is the specification; TS
            (heatFromSlips + serverHeat) is authoritative, verified via `bend --check-only`. */}
        {/* HEAT HALL — one-glance pending heat */}
        {(() => {
          const local = heatFromSlips(slips);
          const useHeat = serverHeat || local.heat;
          let hottest: string|null = local.hottest;
          let max = local.max;
          if (serverHeat) {
            let m=0; let h:string|null=null;
            for (const id of BUILDING_IDS) { const c = (serverHeat as any)[id]||0; if (c>m){m=c; h=id;} }
            if (m>0){ hottest=h; max=m; }
          }
          const label = hottest ? (BUILDING_LABEL[hottest] || hottest) : "";
          return (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky/20 bg-white/90 px-3 py-2 shadow-sm">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/50">Heat Hall</span>
              {hottest ? (
                <span className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="inline-block h-2 w-2 rounded-full bg-brick animate-pulse" aria-hidden />
                  <span className="font-bold text-brick">{label} hottest · {max} pending</span>
                  <span className="hidden sm:inline text-ink/40">open Roadmap → tap red hall for ×1.5</span>
                  <button onClick={() => {
                    try { localStorage.setItem(HEAT_BOOST_KEY, JSON.stringify({ buildingId: hottest, ts: Date.now() })); setBoostHall(hottest); setHeatToast(`Next ticket ×1.5 for ${label}`); setTimeout(()=>setHeatToast(""),2600);} catch {}
                  }} className="ml-1 rounded-full bg-brick px-2.5 py-1 text-[11px] font-bold text-white hover:bg-brick/90">Tap ×1.5</button>
                </span>
              ) : (
                <span className="font-mono text-[11px] text-ink/40">no pending heat — post a slip</span>
              )}
              {boostHall && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-mono text-[10px] font-bold text-amber-800">Next ticket ×1.5 for {BUILDING_LABEL[boostHall] || boostHall}</span>}
            </div>
          );
        })()}
        {heatToast && <div role="status" className="mt-2 rounded-full bg-ink px-3 py-1.5 text-center font-mono text-xs font-bold text-white">{heatToast}</div>}
        {/* NAME VOTES — pending hall alias disputes (vine visibility) */}
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/80 px-3 py-2 shadow-sm">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-800">Name votes</span>
          {aliasLoading ? (
            <span className="font-mono text-[11px] text-ink/40">syncing…</span>
          ) : aliases.length === 0 ? (
            <span className="font-mono text-[11px] text-ink/40">no pending hall disputes — e.g. LT1 vs Lecture Theatre 1 will appear here</span>
          ) : (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {aliases.slice(0, 3).map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-2.5 py-1 font-mono text-[11px] shadow-sm">
                  <span className="font-bold text-ink">{a.alias} → {a.canonical}</span>
                  <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] tabular-nums text-ink/60">{Number(a.votes_yes) || 0}Y · {Number(a.votes_no) || 0}N</span>
                  <button
                    onClick={() => voteAlias(a)}
                    disabled={!!aliasBusy || (!uid || !session)}
                    className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${uid && session ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-ink/10 text-ink/30 cursor-not-allowed"} disabled:opacity-50`}
                    title={uid && session ? "Vote yes (25 cap respected)" : "Unlock wallet on Profile to vote"}
                  >
                    {aliasBusy === a.id ? "…" : "Vote"}
                  </button>
                </span>
              ))}
              <a href="/app/roadmap" className="font-mono text-[11px] font-bold text-amber-700 hover:underline">all →</a>
            </div>
          )}
        </div>
        {aliasMsg && <p className="mt-1 font-mono text-[11px] text-ink/60" role="status">{aliasMsg}</p>}

        {/* FLOWCHART — 5 pills */}
        <div className="mt-5 overflow-x-auto">
          <div className="flex min-w-[640px] items-center gap-2 rounded-[20px] border border-sky/25 bg-white/80 px-3 py-3 shadow-sm backdrop-blur sm:min-w-0 sm:justify-between sm:px-4">
            {[
              { n: "1", label: "Post", sub: "you pin it" },
              { n: "2", label: "Mempool", sub: "pending" },
              { n: "3", label: "Mine", sub: "lottery · lowest wins" },
              { n: "4", label: "Block", sub: "prev_hash + tx_root" },
              { n: "5", label: "Chain", sub: "verifiable" },
            ].map((p, i) => (
              <div key={p.label} className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-2 shadow-sm">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[11px] font-black text-white">{p.n}</span>
                  <div className="pr-1 text-left leading-none">
                    <p className="text-[13px] font-black tracking-tight">{p.label}</p>
                    <p className="font-mono text-[10px] text-ink/50">{p.sub}</p>
                  </div>
                </div>
                {i < 4 && <span className="px-1 font-mono text-[14px] font-black text-accent/60">→</span>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-center font-mono text-[10px] tracking-wide text-ink/40">tap left to post · tap center to mine · right is what the chain remembers</p>
        </div>

        {/* CENTER — 3 columns, stack on mobile */}
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* LEFT — Live slips (mempool) */}
          <div className="flex min-h-[420px] flex-col rounded-[20px] border border-sky/25 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-[17px] font-black tracking-tight">Live slips</h2>
              <span className="rounded-full bg-sky/20 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wide text-ink/60">
                {slipsLoading ? "…" : `${slips.length} pending`}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink/50">Mempool — newest venue changes, awaiting votes. Up to 12 seal into the next block.</p>

            {/* Conversational posting — prompt engineering IS the interface (3-step, one tap, progress bar) */}
            <div className="mt-3">
              <QuizPost
                variant="board"
                onPosted={() => {
                  loadSlips();
                  loadRound().catch(() => {});
                }}
              />
              {!uid && (
                <p className="mt-2 font-mono text-[10px] text-brick">
                  Need a handle — <a href="/app/profile" className="underline">create one on Profile</a>
                </p>
              )}
            </div>

            {/* slips list */}
            <div className="mt-4 flex-1 space-y-3">
              {slipsLoading ? (
                <>
                  {[0, 1, 2].map((k) => (
                    <div key={k} className="slip animate-pulse p-4">
                      <div className="h-3 w-24 rounded bg-ink/10" />
                      <div className="mt-2 h-4 w-3/4 rounded bg-ink/10" />
                      <div className="mt-2 h-3 w-1/2 rounded bg-ink/10" />
                    </div>
                  ))}
                </>
              ) : slipsError ? (
                <div className="rounded-xl border border-brick/20 bg-brick/5 px-3 py-3 font-mono text-xs text-brick">
                  {slipsError}
                  <button onClick={loadSlips} className="ml-2 font-bold underline">Retry</button>
                </div>
              ) : slips.length === 0 ? (
                <div className="slip border-dashed p-6 text-center">
                  <p className="font-display text-[15px] font-bold">No pending slips</p>
                  <p className="mt-1 font-mono text-xs text-ink/50">Be first — tap Post a slip above.</p>
                </div>
              ) : (
                // Bend spec (bend/Face.bend face_cells, parallel) is the specification,
                // verified via `bend --check-only`; TS Array.map below is the runtime.
                slips.map((s) => (
                  <div key={s.id} className="slip p-4 pt-5 transition-transform duration-200 hover:scale-[1.015] hover:shadow-lg">
                    <p className="tnum font-mono text-[11px] text-ink/50">
                      {String(s.event_time).slice(0, 5)} · {String(s.event_date).slice(0, 10)} · {s.status === "verified" ? "✓ confirmed" : "pending"}
                    </p>
                    <p className="font-display mt-0.5 text-[15px] font-black leading-snug tracking-tight">{s.venue}</p>
                    <p className="text-[13px] font-semibold leading-snug text-ink/80">{s.title}</p>
                    <p className="mt-1 font-mono text-[10px] text-ink/40">
                      {s.scope_type}
                      {s.scope_value ? ` · ${s.scope_value}` : ""}
                      {s.severity ? ` · ${s.severity}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>

            <a href="/app/roadmap" className="mt-3 inline-flex items-center gap-1 self-start font-mono text-[11px] font-bold text-accent hover:underline">
              Open full feed
              <span aria-hidden>→</span>
            </a>
          </div>

          {/* CENTER — Current mining round */}
          <div className="flex min-h-[420px] flex-col rounded-[20px] border border-ink/10 bg-ink p-4 text-white shadow-sm sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[17px] font-black tracking-tight">Current round</h2>
              <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-wide ${round?.status === "open" ? "bg-emerald-400 text-ink" : "bg-white/15 text-white/70"}`}>
                {roundLoading ? "syncing…" : round ? round.status : "—"}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/55">One tap = 64 tickets, best kept. Lowest wins when time hits 0.</p>

            {roundLoading ? (
              <div className="mt-5 space-y-3">
                <div className="h-10 animate-pulse rounded-xl bg-white/10" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
                  <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
                </div>
                <div className="h-14 animate-pulse rounded-full bg-white/10" />
              </div>
            ) : roundError ? (
              <div className="mt-4 rounded-xl border border-white/15 bg-white/5 px-3 py-3 font-mono text-xs text-white/80">
                {roundError}
                <button onClick={loadRound} className="ml-2 font-bold underline">Retry</button>
              </div>
            ) : round ? (
              <>
                {/* stats row */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-white px-3 py-3 text-ink">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">Round</p>
                    <p className="font-display mt-0.5 text-xl font-black tabular-nums">#{round.round}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3 text-ink">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">Ends in</p>
                    <p className={`font-display mt-0.5 text-xl font-black tabular-nums ${secondsLeft <= 15 ? "text-brick" : "text-ink"}`}>{fmtTimeLeft(secondsLeft)}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3 text-ink">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink/45">Reward</p>
                    <p className="font-display mt-0.5 text-xl font-black tabular-nums">{round.reward} <span className="text-[11px] font-bold text-ink/40">$PHY</span></p>
                  </div>
                </div>

                {/* bar */}
                <div className="mt-3 rounded-2xl bg-white/10 px-3 py-3">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="tracking-widest text-white/60">BAR</span>
                    <span className="font-bold tabular-nums text-white">{round.difficulty}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/30">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky to-white transition-all" style={{ width: `${barPct}%` }} />
                  </div>
                  <p className="mt-1.5 font-mono text-[10px] leading-none text-white/50">Beat the bar to get a ticket · lower ticket wins</p>
                </div>

                {/* tickets */}
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">Leader ticket</p>
                    <p className="mt-1 truncate font-mono text-[12px] font-bold tabular-nums" title={round.leader?.ticket || undefined}>
                      {round.leader?.ticket ? `0x${shortHex(round.leader.ticket, 12, 8)}` : "— be first"}
                    </p>
                    <p className="font-mono text-[10px] text-white/40">{round.leader ? "current best — beat it" : "no leader yet"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">Last code</p>
                    <p className="mt-1 truncate font-mono text-[11px] font-bold tabular-nums" title={round.prev_hash || undefined}>
                      {shortHex(round.prev_hash, 14, 8)}
                    </p>
                    <p className="font-mono text-[10px] text-white/40">prev winning ticket · chained</p>
                  </div>
                </div>
              </>
            ) : null}

            {/* juicy earning preview — variable by bar + XP level (additive, 25cap + session respected) */}
            <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-50 p-3 text-ink">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-700">If you win this round: +1 PHY + streak × + invite bonus</p>
              <p className="font-display mt-1 text-[13px] font-black leading-tight">→ {totalPreviewBoard} PHY <span className="font-mono text-[11px] font-bold text-ink/50">variable · bar {round?.difficulty ?? "—"} + XP Lv.{level}</span></p>
              <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[10px]">
                <span className="rounded-full border border-ink/10 bg-white px-2 py-0.5">+1.00 base</span>
                <span className="rounded-full border border-ink/10 bg-white px-2 py-0.5">+{xpBonusBoard.toFixed(2)} XP</span>
                <span className="rounded-full border border-ink/10 bg-white px-2 py-0.5">+{streakBonusBoard.toFixed(2)} streak</span>
                <span className="rounded-full border border-ink/10 bg-white px-2 py-0.5">+{barBonusBoard.toFixed(2)} bar</span>
                <span className="rounded-full border border-forest/20 bg-forest/10 px-2 py-0.5 font-bold text-forest">+0.50 / invite</span>
              </div>
              <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink/50">25 entries max/round · session-gated — your next tap is previewed above.</p>
            </div>

            {/* mine */}
            <div className="mt-auto pt-4">
              <button
                onClick={mine}
                disabled={mineBusy || (!!uid && !session) || roundLoading}
                className={`flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[14px] font-black transition ${mineBusy ? "bg-white/80 text-ink" : uid && session ? "bg-white text-ink hover:bg-sky hover:shadow-lg active:scale-[0.98]" : "bg-white/15 text-white/70 cursor-not-allowed"}`}
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[11px] text-white">⛏</span>
                {mineBusy ? "Dealing…" : roundLoading ? "Syncing…" : !uid ? "Create handle to mine" : !session ? "Unlock wallet to mine" : "Mine this round"}
                <span aria-hidden>→</span>
              </button>
              <p className="mt-2 text-center font-mono text-[11px] text-white/50">
                {handle ? `@${handle}` : "no handle"} · {uid && session ? "one tap" : <a href="/app/profile" className="underline">unlock on Profile</a>} · 1 $PHY at close
              </p>
              <div
                className={`mt-2 rounded-xl border px-3 py-2 font-mono text-[11px] leading-relaxed ${mineKind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : mineKind === "error" ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/60"}`}
                aria-live="polite"
              >
                {mineMsg || "Ready — one tap enters you. Lowest ticket at close takes the coin."}
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-white/35">
                <span>{round ? `${round.lattice_order}×${round.lattice_order} grid` : ""}</span>
                <a href="/app/mining" className="font-bold text-white/60 hover:text-white">Open mining →</a>
              </div>
            </div>
          </div>

          {/* RIGHT — Chain */}
          <div className="flex min-h-[420px] flex-col rounded-[20px] border border-sky/25 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[17px] font-black tracking-tight">Chain</h2>
              <span className="rounded-full bg-ink px-2.5 py-1 font-mono text-[10px] font-bold text-white">last 3 blocks</span>
            </div>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink/50">Each header holds <span className="font-bold text-ink/70">prev_hash</span> + <span className="font-bold text-ink/70">tx_root</span>. Empty still chained.</p>

            {chainLoading ? (
              <div className="mt-4 space-y-3">
                {[0, 1, 2].map((k) => (
                  <div key={k} className="h-24 animate-pulse rounded-2xl bg-ink/5" />
                ))}
              </div>
            ) : chainError ? (
              <div className="mt-4 rounded-xl border border-brick/20 bg-brick/5 px-3 py-3 font-mono text-xs text-brick">
                {chainError}
                <button onClick={loadChain} className="ml-2 font-bold underline">Retry</button>
              </div>
            ) : blocks.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-sky/30 bg-paper p-6 text-center">
                <p className="font-display text-[15px] font-bold">No blocks yet</p>
                <p className="mt-1 font-mono text-xs text-ink/50">Mine the first round — it mints the genesis.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {blocks.slice(0, 3).map((b) => (
                  <a
                    key={b.number}
                    href={`/api/rounds?round=${b.number}`}
                    className="block rounded-2xl border border-sky/20 bg-paper p-3 hover:border-accent/30 hover:bg-white"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-black">#{b.number}</span>
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${b.status === "closed" ? "bg-emerald-50 text-emerald-700" : "bg-sky/20 text-ink/60"}`}>
                        {b.status === "closed" ? (b.winner ? `@${b.winner}` : "empty") : "open"}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
                      <span className="truncate">
                        <span className="text-ink/40">txs </span>
                        <span className="font-bold tabular-nums">{b.tx_count != null ? String(b.tx_count) : "—"}</span>
                        <span className="ml-1 text-ink/40">· ticket</span>
                      </span>
                      <span className="truncate text-right tabular-nums font-bold" title={(b.winning_ticket as string) || undefined}>
                        {(b.winning_ticket as string) ? shortHex(b.winning_ticket as string, 6, 4) : b.winning_score !== null ? `score ${b.winning_score}` : "—"}
                      </span>
                    </div>
                    {b.prev_hash && (
                      <p className="mt-1 truncate font-mono text-[10px] text-ink/40" title={b.prev_hash}>
                        prev {shortHex(b.prev_hash, 6, 4)}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            )}

            {/* schedule version */}
            <div className="mt-3 rounded-2xl border border-ink/8 bg-ink/[0.02] px-3 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink/40">Timetable version</p>
              {schedule?.version == null ? (
                <p className="mt-1 font-mono text-xs text-ink/60">No version yet — first winner mints v1.</p>
              ) : (
                <>
                  <p className="font-mono text-xs font-bold tabular-nums">
                    v{schedule.version} · {schedule.lattice_order}×{schedule.lattice_order} · score {schedule.score} · by {schedule.winner || "genesis"}
                  </p>
                  {schedule.cells && schedule.cells.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {schedule.cells.slice(0, 6).map((c) => (
                        <div key={`${c.row}-${c.col}`} className="rounded-lg border border-sky/20 bg-white px-2 py-1.5 text-center">
                          <p className="font-mono text-[9px] text-ink/40">{c.period}</p>
                          <p className="font-display text-[11px] font-bold leading-none">{c.hall}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 truncate font-mono text-[10px] text-ink/40" title={schedule.ticket}>
                    ticket {schedule.ticket ? shortHex(schedule.ticket, 10, 6) : "—"}
                  </p>
                </>
              )}
            </div>

            <a href="/app/rounds" className="mt-3 inline-flex items-center gap-1 self-start font-mono text-[11px] font-bold text-accent hover:underline">
              View full chain
              <span aria-hidden>→</span>
            </a>
          </div>
        </section>

        {/* BOTTOM — Leaderboard snippet */}
        <section className="mt-4 rounded-[20px] border border-sky/20 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[17px] font-black tracking-tight">Leaderboard</h2>
            <a href="/app/rounds" className="font-mono text-[11px] font-bold text-accent hover:underline">Full board →</a>
          </div>
          <p className="mt-1 font-mono text-[11px] text-ink/50">Top miners — test wallets don&apos;t rank. 1 $PHY per round, 0.5 on invite&apos;s first win.</p>
          {leadersLoading ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((k) => (
                <div key={k} className="h-16 animate-pulse rounded-2xl bg-ink/5" />
              ))}
            </div>
          ) : leaders.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-ink/15 bg-paper px-4 py-6 text-center font-mono text-xs text-ink/50">No winners yet — your tap could be first.</p>
          ) : (
            <div className="mt-4 divide-y divide-ink/8 overflow-hidden rounded-2xl border border-ink/10">
              {leaders.map((l, i) => (
                <div key={l.nickname} className="flex items-center justify-between gap-3 bg-white px-3 py-3 sm:px-4">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${i === 0 ? "bg-amber-400 text-ink" : i === 1 ? "bg-ink/10 text-ink" : i === 2 ? "bg-brick/10 text-brick" : "bg-ink/5 text-ink/60"}`}>
                      {i + 1}
                    </span>
                    <span className="font-mono text-sm font-black">@{l.nickname}</span>
                  </div>
                  <span className="hidden font-mono text-xs text-ink/50 sm:inline">best {l.best_score}</span>
                  <span className="font-mono text-xs">
                    <span className="font-black">{l.wins} wins</span>
                    <span className="ml-2 text-emerald-700">+{Number(l.earned).toFixed(2)} $PHY</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Growth Pulse — exit-metrics one-glance card (additive, below leaderboard) */}
        <GrowthPulse />

        <p className="mt-6 text-center font-mono text-[11px] text-ink/35">One glance, no jargon · Post = human, Mine = lottery, Block = receipt, Chain = proof · mempool → block locks up to 12 slips</p>
      </div>
    </div>
  );
}
