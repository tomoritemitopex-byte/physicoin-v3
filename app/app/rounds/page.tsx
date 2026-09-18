"use client";

import { useCallback, useEffect, useState } from "react";

type RoundRow = {
  number: number;
  status: string;
  winning_score: number | null;
  winning_ticket?: string | null;
  winner: string | null;
  reward: string;
  prev_hash?: string | null;
  tx_root?: string | null;
  tx_count?: number | null;
  lattice_order?: number | null;
  difficulty?: number | null;
};

type Leader = { nickname: string; wins: number; earned: string; best_score: number };
type Tx = { id: string; title: string; venue: string; event_date: string; status: string };
type Cell = { row: number; col: number; hall: string; period: string; programme: string; level: string };

type Detail = {
  block: RoundRow & { winning_ticket?: string | null; prev_hash?: string | null; tx_root?: string | null; tx_count?: number | null; lattice_order?: number };
  txs: Tx[];
  grid_hex: string | null;
  lattice_order?: number;
  lattice_preview: Cell[] | null;
};

const ROUNDS_CACHE = "physi_rounds_cache_v3";
const LEADERS_CACHE = "physi_leaders_cache_v3";

function shortHex(h: string | null | undefined, head = 8, tail = 6): string {
  if (!h) return "—";
  if (h === "GENESIS") return "GENESIS";
  const s = String(h).toLowerCase();
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function loadCache<T>(key: string): T | null {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
function saveCache<T>(key: string, v: T) {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

export default function RoundsPage() {
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, Detail>>({});
  const [detailLoading, setDetailLoading] = useState<number | null>(null);
  const [detailError, setDetailError] = useState<Record<number, string>>({});

  const fetchRounds = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/rounds?limit=30", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.message || "Could not load rounds.");
      const list: RoundRow[] = (j.rounds || []) as RoundRow[];
      setRounds(list);
      saveCache(ROUNDS_CACHE, list);
      const lr = await fetch("/api/rounds?view=leaders&limit=10", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (lr?.ok && Array.isArray(lr.leaders)) {
        setLeaders(lr.leaders as Leader[]);
        saveCache(LEADERS_CACHE, lr.leaders);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load rounds.";
      // offline cache gracefully: keep cached rounds if any
      if (rounds.length > 0) {
        setError(`${msg} — showing cached chain.`);
      } else {
        const cached = loadCache<RoundRow[]>(ROUNDS_CACHE);
        if (cached && cached.length > 0) {
          setRounds(cached);
          setError(`${msg} — showing cached chain.`);
        } else {
          setError(msg);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []); // rounds dependency intentional: we read initial value only

  useEffect(() => {
    // hydrate from cache first so offline shows something before network
    const cr = loadCache<RoundRow[]>(ROUNDS_CACHE);
    if (cr && cr.length > 0) setRounds(cr);
    const cl = loadCache<Leader[]>(LEADERS_CACHE);
    if (cl && cl.length > 0) setLeaders(cl);
    // then network
    fetchRounds();
  }, [fetchRounds]);

  const toggle = useCallback(async (n: number) => {
    if (expanded === n) {
      setExpanded(null);
      return;
    }
    setExpanded(n);
    if (details[n]) return;
    setDetailLoading(n);
    setDetailError((m) => ({ ...m, [n]: "" }));
    try {
      const r = await fetch(`/api/rounds?round=${n}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.message || j.code || "Could not load block.");
      const d: Detail = { block: j.block, txs: j.txs || [], grid_hex: j.grid_hex ?? null, lattice_order: j.lattice_order, lattice_preview: j.lattice_preview ?? null };
      setDetails((m) => ({ ...m, [n]: d }));
      // also enrich the row's inline prev/tx hints for sparkline continuity
      setRounds((prev) => prev.map((row) => row.number === n ? { ...row, prev_hash: d.block.prev_hash ?? row.prev_hash, winning_ticket: (d.block as any).winning_ticket ?? (row as any).winning_ticket, tx_root: d.block.tx_root ?? row.tx_root, tx_count: (d.block as any).tx_count ?? row.tx_count } : row));
    } catch (e) {
      setDetailError((m) => ({ ...m, [n]: e instanceof Error ? e.message : "Could not load block." }));
    } finally {
      setDetailLoading(null);
    }
  }, [expanded, details]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 text-ink">
      <h1 className="font-display text-3xl font-black tracking-tight">Round history</h1>
      <p className="mt-1 text-sm text-ink/60">
        Every block locks timetable slips. Mining mints the timetable — chain, grid, and txs together. Tap any row to see <span className="font-mono text-[11px]">prev_hash → winning_ticket</span> + <span className="font-mono text-[11px]">tx_root</span>.
      </p>

      {leaders.length > 0 && (
        <div className="mt-4 rounded-2xl border border-accent/30 bg-white p-4">
          <p className="font-mono text-[11px] uppercase tracking-widest text-ink/50">Leaderboard</p>
          {leaders.map((l, i) => (
            <div key={l.nickname} className="mt-1 flex items-center justify-between font-mono text-xs">
              <span className="font-black">{i + 1}. @{l.nickname}</span>
              <span>{l.wins} wins · +{l.earned} · best {l.best_score}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((k) => <div key={k} className="h-[52px] animate-pulse rounded-xl bg-ink/5" />)}
        </div>
      ) : error && rounds.length === 0 ? (
        <div className="mt-4 rounded-xl border border-brick/20 bg-brick/5 px-3 py-3 font-mono text-xs text-brick">
          {error} <button onClick={fetchRounds} className="ml-2 font-bold underline">Retry</button>
        </div>
      ) : (
        <>
          {error && <p className="mt-2 font-mono text-[11px] text-amber-700">{error}</p>}
          <div className="mt-4 space-y-2">
            {rounds.map((r) => {
              const isOpen = expanded === r.number;
              const d = details[r.number];
              const isLoading = detailLoading === r.number;
              return (
                <div key={r.number} className={`overflow-hidden rounded-xl border bg-white ${isOpen ? "border-accent/40 shadow-sm" : "border-sky/20 hover:border-accent/30"}`}>
                  <button
                    onClick={() => toggle(r.number)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left font-mono text-xs"
                    aria-expanded={isOpen}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${isOpen ? "bg-ink text-white" : "bg-sky/20 text-ink/60"}`}>{isOpen ? "−" : "+"}</span>
                      <span className="font-black">#{r.number}</span>
                      <span className={`hidden rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:inline ${r.status === "closed" ? "bg-emerald-50 text-emerald-700" : "bg-sky/20 text-ink/60"}`}>{r.status === "closed" ? (r.winner ? `@${r.winner}` : "empty") : "open…"}</span>
                    </span>
                    <span className="hidden sm:inline">{r.winning_score !== null ? `score ${r.winning_score}` : "—"}</span>
                    <span className="font-bold">+{r.reward}</span>
                    <span className="hidden text-ink/40 sm:inline" title={r.prev_hash || undefined}>{r.prev_hash ? shortHex(r.prev_hash, 6, 4) : ""}</span>
                    <span className="text-ink/30">{isOpen ? "▴" : "▾"}</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-sky/20 bg-paper px-3 py-3">
                      {isLoading ? (
                        <div className="space-y-2 py-2"><div className="h-4 animate-pulse rounded bg-ink/5" /><div className="h-20 animate-pulse rounded bg-ink/5" /></div>
                      ) : detailError[r.number] ? (
                        <div className="rounded-xl border border-brick/20 bg-white px-3 py-2 font-mono text-xs text-brick">
                          {detailError[r.number]} <button onClick={() => toggle(r.number)} className="ml-2 font-bold underline">Retry</button>
                        </div>
                      ) : d ? (
                        <>
                          {/* chain linkage strip: one-glance prev_hash → winning_ticket */}
                          <div className="rounded-xl border border-ink/10 bg-white p-3">
                            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/40">Chain linkage · one glance</p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                              <span className="rounded-full border border-sky/30 bg-sky/10 px-2 py-1 font-bold" title={d.block.prev_hash || undefined}>prev {shortHex(d.block.prev_hash, 8, 6)}</span>
                              <span className="font-black text-accent">→</span>
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-bold" title={(d.block as any).winning_ticket || undefined}>ticket {d.block.winning_ticket ? shortHex((d.block as any).winning_ticket, 8, 6) : "— (empty/header only)"}</span>
                              <span className="font-black text-accent">→</span>
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-bold" title={d.block.tx_root || undefined}>tx_root {shortHex(d.block.tx_root, 8, 6)}</span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] text-ink/60">
                              <span>txs <b className="text-ink tabular-nums">{d.block.tx_count ?? d.txs.length}</b> · status <b className="text-ink">{d.block.status}</b></span>
                              <span className="text-right">order <b className="text-ink">{(d.block as any).lattice_order ?? d.lattice_order ?? "—"}</b> · score <b className="text-ink">{d.block.winning_score ?? "—"}</b></span>
                            </div>
                          </div>

                          {/* txs list */}
                          <div className="mt-3">
                            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/40">Txs in this block · up to 12</p>
                            {d.txs.length === 0 ? (
                              <p className="mt-1 rounded-xl border border-dashed border-sky/30 bg-white px-3 py-3 text-center font-mono text-xs text-ink/50">Empty block — still chained (prev → ticket → tx_root), no slips this round.</p>
                            ) : (
                              <ul className="mt-1 divide-y divide-sky/15 overflow-hidden rounded-xl border border-sky/20 bg-white">
                                {d.txs.map((t) => (
                                  <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 font-mono text-xs">
                                    <span className="truncate"><span className="font-bold text-ink">{t.venue}</span> <span className="text-ink/60">· {t.title}</span></span>
                                    <span className="shrink-0 text-ink/40">{String(t.event_date).slice(0, 10)} · {t.status}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* lattice grid preview */}
                          <div className="mt-3">
                            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink/40">Lattice grid preview · winner&apos;s timetable</p>
                            {d.lattice_preview && d.lattice_preview.length > 0 ? (
                              <>
                                <div className="mt-1 grid gap-1 rounded-xl border border-ink/10 bg-white p-2" style={{ gridTemplateColumns: `repeat(${Math.sqrt(d.lattice_preview.length) || 6}, minmax(0, 1fr))` }}>
                                  {d.lattice_preview.slice(0, Math.min(d.lattice_preview.length, 36)).map((c) => (
                                    <div key={`${c.row}-${c.col}`} className="rounded-lg border border-sky/20 bg-paper px-1 py-1.5 text-center">
                                      <p className="font-mono text-[8px] leading-none text-ink/40">{c.period}</p>
                                      <p className="font-display text-[11px] font-bold leading-none">{c.hall}</p>
                                      <p className="truncate font-mono text-[8px] leading-none text-ink/50">{c.level}</p>
                                    </div>
                                  ))}
                                </div>
                                <p className="mt-1 font-mono text-[10px] text-ink/40">v{d.block.number} · {d.lattice_preview.length} cells · ticket {d.block.winning_ticket ? shortHex((d.block as any).winning_ticket, 10, 6) : "—"}</p>
                              </>
                            ) : d.grid_hex ? (
                              <div className="mt-1 rounded-xl border border-sky/20 bg-white p-3">
                                <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${d.lattice_order || 6}, minmax(0, 1fr))` }}>
                                  {[...d.grid_hex].slice(0, (d.lattice_order || 6) * (d.lattice_order || 6) * 2).map((ch, i) => (
                                    <div key={i} className="grid h-7 place-items-center rounded bg-paper font-mono text-[10px] font-bold text-ink/70">{ch.toUpperCase()}</div>
                                  ))}
                                </div>
                                <p className="mt-2 font-mono text-[10px] text-ink/40">raw nibble grid · {d.lattice_order || 6}×{d.lattice_order || 6}</p>
                              </div>
                            ) : (
                              <p className="mt-1 rounded-xl border border-dashed border-sky/30 bg-white px-3 py-3 text-center font-mono text-xs text-ink/50">
                                No grid for this block — empty or pre-lattice. <a href="/app/schedule" className="font-bold text-accent underline">See current timetable →</a>
                              </p>
                            )}
                          </div>

                          <div className="mt-3 flex justify-end">
                            <a href={`/api/rounds?round=${r.number}`} className="font-mono text-[11px] font-bold text-accent hover:underline">raw JSON →</a>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
            {rounds.length === 0 && <p className="text-sm text-ink/50">No rounds yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}
