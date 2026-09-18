"use client";
import { useEffect, useState } from "react";

type TeleRound = {
  round: number;
  tx_count: number;
  subs: number;
  bar: number;
  difficulty: number;
  barCap: number;
  lattice_order: number;
  winning_score: number | null;
  winning_ticket: string | null;
  ticket_prefix: string | null;
  prev_hash: string | null;
  tx_root: string | null;
  status: string;
};
type Flags = { SATURATED: boolean; BAR_MAX: boolean; LATTICE_STALL: boolean; detail: { saturatedWindow: number[] | null; barMaxRounds: number[]; stallReason: string | null } };

const CACHE_KEY = "physi_telemetry_cache";
const CACHE_AT = "physi_telemetry_at";

function Spark({ vals, color }: { vals: number[]; color: string }) {
  if (vals.length < 2) return <span className="font-mono text-[11px] text-white/30">—</span>;
  const w = 84, h = 22, pad = 2;
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" points={pts} opacity={0.95} />
      {vals.map((v, i) => {
        const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="1.3" fill={color} opacity={0.9} />;
      })}
    </svg>
  );
}

function Pill({ label, active, subtle }: { label: string; active: boolean; subtle?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] font-black tracking-wide ${active ? "border-transparent text-white shadow" : "border-white/12 bg-white/[0.04] text-white/55"}`}
      style={active ? { background: label === "SATURATED" ? "#dc2626" : label === "BAR_MAX" ? "#d97706" : "#7c3aed" } : undefined}
      title={subtle || label}
    >
      <span className={`h-2 w-2 rounded-full ${active ? "bg-white" : "bg-white/30"}`} />
      {label}
      <span className={`ml-1 font-normal ${active ? "text-white/90" : "text-white/35"}`}>{active ? "ON" : "off"}</span>
    </span>
  );
}

export default function TelemetryPage() {
  const [rounds, setRounds] = useState<TeleRound[]>([]);
  const [flags, setFlags] = useState<Flags>({ SATURATED: false, BAR_MAX: false, LATTICE_STALL: false, detail: { saturatedWindow: null, barMaxRounds: [], stallReason: null } });
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [at, setAt] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // try cache first for instant paint
      try {
        const c = localStorage.getItem(CACHE_KEY);
        const t = localStorage.getItem(CACHE_AT);
        if (c) {
          const j = JSON.parse(c);
          if (!cancelled && j.recentRounds) {
            setRounds(j.recentRounds || j.rounds || []);
            if (j.flags) setFlags(j.flags);
            if (t) setAt(t);
          }
        }
      } catch {}
      // then network
      try {
        const r = await fetch("/api/telemetry?limit=20", { cache: "no-store" });
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.message || "telemetry unavailable");
        const list: TeleRound[] = j.recentRounds || j.rounds || [];
        if (!cancelled) {
          setRounds(list);
          if (j.flags) setFlags(j.flags);
          setAt(j.at || new Date().toISOString());
          setOffline(false);
          setErr("");
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(j));
            localStorage.setItem(CACHE_AT, j.at || new Date().toISOString());
          } catch {}
        }
      } catch (e) {
        if (!cancelled) {
          // fallback to cache already painted; mark offline
          const hasCache = (() => { try { return !!localStorage.getItem(CACHE_KEY); } catch { return false; } })();
          setOffline(true);
          setErr(hasCache ? "" : (e instanceof Error ? e.message : "offline"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const onOnline = () => load();
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { cancelled = true; window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  const txVals = [...rounds].sort((a, b) => a.round - b.round).map((r) => r.tx_count);
  const subsVals = [...rounds].sort((a, b) => a.round - b.round).map((r) => r.subs);
  const scoreVals = [...rounds].sort((a, b) => a.round - b.round).map((r) => r.winning_score ?? 0);

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">admin · exit metrics</p>
          <h1 className="font-display mt-1 text-[28px] font-black tracking-tight">Telemetry <span className="font-normal text-white/35">· 20 rounds</span></h1>
          <p className="mt-2 max-w-[560px] text-[13px] leading-relaxed text-white/55">
            Structural traffic · tickets grind but slips stall before regulation. One glance, no 50-page table.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill label="SATURATED" active={flags.SATURATED} subtle={flags.detail.saturatedWindow ? `3× zero-tx ${flags.detail.saturatedWindow.join("→")}` : "tx==0 ×3 while subs>0"} />
          <Pill label="BAR_MAX" active={flags.BAR_MAX} subtle={flags.detail.barMaxRounds?.length ? `cap hit @ ${flags.detail.barMaxRounds.join(",")}` : "bar hits cap"} />
          <Pill label="LATTICE_STALL" active={flags.LATTICE_STALL} subtle={flags.detail.stallReason || "wins flatline"} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-white/40">
        <span className={offline ? "text-amber-300" : "text-emerald-300"}>{offline ? "● offline — cached" : "● live"}</span>
        <span>{at ? new Date(at).toLocaleTimeString() : ""}</span>
        <button onClick={() => location.reload()} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-bold text-white/70 hover:bg-white/10">Refresh</button>
        <a href="/app/admin" className="text-white/50 underline">admin log →</a>
      </div>

      {/* sparklines strip */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">tx_count · slips per block</p>
          <div className="mt-2 flex items-center justify-between">
            <Spark vals={txVals} color="#a8f5ce" />
            <span className="font-mono text-xs font-bold text-white">{txVals.reduce((a, b) => a + b, 0)} total</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-white/35">0 = empty block</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">subs · tickets per round</p>
          <div className="mt-2 flex items-center justify-between">
            <Spark vals={subsVals} color="#80e8dc" />
            <span className="font-mono text-xs font-bold text-white">{subsVals.reduce((a, b) => a + b, 0)} grinds</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-white/35">tickets grind but no slips = saturated</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">winning_score · lattice health</p>
          <div className="mt-2 flex items-center justify-between">
            <Spark vals={scoreVals} color="#f59e0b" />
            <span className="font-mono text-xs font-bold text-white">{scoreVals.length ? `min ${Math.min(...scoreVals)}` : "—"}</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-white/35">flatline = no puzzle progress</p>
        </div>
      </div>

      {/* flag detail banner */}
      {(flags.SATURATED || flags.BAR_MAX || flags.LATTICE_STALL) && (
        <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 font-mono text-xs leading-relaxed text-amber-100">
          {flags.SATURATED && <span className="mr-3">⚠ SATURATED{flags.detail.saturatedWindow ? ` @ ${flags.detail.saturatedWindow.join("→")}` : ""} — tickets flow, slips don’t.</span>}
          {flags.BAR_MAX && <span className="mr-3">⚠ BAR_MAX{flags.detail.barMaxRounds?.length ? ` @ #${flags.detail.barMaxRounds.slice(0, 3).join(",#")}` : ""} — bar at cap, eligibility maxed.</span>}
          {flags.LATTICE_STALL && <span>⚠ LATTICE_STALL{flags.detail.stallReason ? ` — ${flags.detail.stallReason}` : ""}</span>}
        </div>
      )}

      {/* compact table */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="w-full font-mono text-[11px]">
          <thead>
            <tr className="text-left text-white/35">
              <th className="p-2 pl-3">round</th>
              <th className="p-2">tx</th>
              <th className="p-2">subs</th>
              <th className="p-2">bar</th>
              <th className="p-2">order</th>
              <th className="p-2">score</th>
              <th className="p-2">ticket</th>
              <th className="p-2">prev_hash</th>
            </tr>
          </thead>
          <tbody>
            {loading && rounds.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-white/40">Syncing…</td></tr>
            ) : rounds.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-white/40">{err || "No rounds yet — genesis pending."}</td></tr>
            ) : rounds.map((r) => (
              <tr key={r.round} className="border-t border-white/5 text-white/75">
                <td className="p-2 pl-3 font-black text-white">#{r.round}</td>
                <td className={`p-2 ${r.tx_count === 0 ? "text-amber-300" : "text-white"}`}>{r.tx_count}</td>
                <td className={`p-2 ${r.subs > 0 && r.tx_count === 0 ? "text-red-300 font-bold" : ""}`}>{r.subs}</td>
                <td className="p-2">{r.bar}<span className="text-white/30">/{r.barCap}</span>{r.bar >= r.barCap && <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-black text-amber-200">cap</span>}</td>
                <td className="p-2">{r.lattice_order}</td>
                <td className="p-2">{r.winning_score ?? "—"}</td>
                <td className="p-2" title={r.winning_ticket || ""}>{r.ticket_prefix ? `0x${r.ticket_prefix}…` : "—"}</td>
                <td className="p-2">
                  {r.prev_hash ? (
                    <a href={`/api/rounds?round=${r.round}`} className="underline decoration-white/20 hover:text-white" title={r.prev_hash}>
                      {r.prev_hash === "GENESIS" ? "GENESIS" : `${r.prev_hash.slice(0, 6)}…${r.prev_hash.slice(-4)}`}
                    </a>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-mono text-[10px] text-white/30">offline-first · cached to localStorage — {offline ? "showing cached" : "live"} · &lt;5KB UI · prev_hash links to round.</p>
    </div>
  );
}
