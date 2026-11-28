"use client";

import { useCallback, useEffect, useState } from "react";

type Block = {
  number: number;
  status: string;
  winner: string | null;
  winning_ticket: string | null;
  prev_hash: string | null;
  ends_at: string | null;
};

type Win = {
  number: number;
  winning_ticket: string;
  prev_hash: string | null;
  winning_score: number | null;
  winner: string | null;
  ends_at: string | null;
};

type ChainCheck = { valid: boolean | null; brokenAt?: number | null; checked: number };

function short(h: string | null | undefined, head = 6, tail = 4): string {
  if (!h) return "—";
  if (h === "GENESIS") return "genesis";
  const s = String(h);
  return s.length <= head + tail ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function when(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export default function LiveChain({
  initialBlocks,
  initialWins,
  initialChain,
  confirmed,
  students,
  mined,
}: {
  initialBlocks: Block[];
  initialWins: Win[];
  initialChain: ChainCheck;
  confirmed: number;
  students: number;
  mined: number;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [wins] = useState<Win[]>(initialWins);
  const [chain, setChain] = useState<ChainCheck>(initialChain);
  const [checking, setChecking] = useState(false);
  const [checkedAgo, setCheckedAgo] = useState<number | null>(null);
  const [err, setErr] = useState(false);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/rounds?limit=6", { cache: "no-store" });
      const j = await r.json();
      if (j.ok && Array.isArray(j.rounds)) {
        setBlocks(j.rounds);
        setErr(false);
      } else setErr(true);
    } catch {
      setErr(true);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(poll, 6000);
    return () => clearInterval(id);
  }, [poll]);

  async function check() {
    setChecking(true);
    try {
      const r = await fetch("/api/rounds?view=chain&limit=500", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) {
        setChain({ valid: j.valid, brokenAt: j.brokenAt ?? null, checked: j.checked });
        setCheckedAgo(0);
      }
    } catch {
      setErr(true);
    } finally {
      setChecking(false);
    }
  }

  const height = blocks[0]?.number ?? 0;

  return (
    <div className="min-h-screen bg-[#05070a] text-[#e8eef4]">
      <div className="mx-auto max-w-5xl px-5 pb-16 pt-6 sm:px-8">
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center bg-[#39ff88] font-mono text-sm font-black text-[#05070a]">P</span>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.28em]">PhysiCoin</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#7d8b99]">
            <span className={`inline-block h-2 w-2 rounded-full ${err ? "bg-[#ff5a3c]" : "bg-[#39ff88] animate-pulse"}`} />
            {err ? "reconnecting" : "live"}
          </div>
        </div>

        {/* the number */}
        <div className="pt-10 sm:pt-14">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-[#39ff88]">blocks sealed</p>
          <p
            className="mt-2 font-mono text-[clamp(3.5rem,15vw,9rem)] font-black leading-[0.85] tracking-[-0.06em] tabular-nums"
            aria-live="polite"
          >
            {height ? height.toLocaleString("en-US") : "—"}
          </p>
          <p className="mt-4 max-w-[40ch] font-mono text-[12px] leading-relaxed uppercase tracking-[0.1em] text-[#7d8b99]">
            one every 120 seconds · no admin key · nobody can switch it off
          </p>
        </div>

        {/* three honest numbers */}
        <div className="mt-9 grid grid-cols-3 gap-3">
          {[
            { k: "sealed by a student", v: mined, note: "winning tickets" },
            { k: "changes confirmed", v: confirmed, note: "8 classmates each" },
            { k: "students", v: students, note: "handles, no emails" },
          ].map((s) => (
            <div key={s.k} className="border border-white/10 bg-[#0b0f14] p-3 sm:p-4">
              <p className="font-mono text-2xl font-black tabular-nums sm:text-3xl">{s.v}</p>
              <p className="mt-1 font-mono text-[9px] font-bold uppercase leading-tight tracking-[0.14em] text-[#7d8b99] sm:text-[10px]">
                {s.k}
              </p>
              <p className="mt-1 hidden font-mono text-[9px] leading-tight text-[#4b5763] sm:block">{s.note}</p>
            </div>
          ))}
        </div>

        {/* the proof */}
        <div className="mt-9 border border-white/10 bg-[#0b0f14] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#7d8b99]">chain check</p>
              <p
                className={`mt-2 font-mono text-xl font-black uppercase tracking-tight sm:text-2xl ${
                  chain.valid === true ? "text-[#39ff88]" : chain.valid === false ? "text-[#ff5a3c]" : "text-[#e8eef4]"
                }`}
              >
                {chain.valid === true
                  ? "every link matches"
                  : chain.valid === false
                    ? `broken at ${chain.brokenAt}`
                    : "not checked"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-[#7d8b99]">
                {chain.checked ? `${chain.checked} blocks walked` : "—"}
                {checkedAgo !== null ? " · just now" : ""}
              </p>
            </div>
            <button
              onClick={check}
              disabled={checking}
              className="border border-[#39ff88] bg-[#39ff88] px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.16em] text-[#05070a] transition hover:bg-white disabled:opacity-50"
            >
              {checking ? "walking…" : "check it yourself"}
            </button>
          </div>
          <p className="mt-4 border-t border-white/10 pt-3 font-mono text-[10px] leading-relaxed text-[#7d8b99]">
            Each block carries the hash of the ticket before it. Change one and every later block fails this check.
            There is no privileged reader.
          </p>
        </div>

        {/* the record — blocks that carry a student's ticket */}
        <div className="mt-9">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#7d8b99]">the record</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#4b5763]">newest first</p>
          </div>
          <div className="mt-3 divide-y divide-white/[0.06] border-y border-white/10">
            {wins.length > 0 ? (
              wins.map((w) => (
                <div key={w.number} className="flex items-center gap-3 py-3 font-mono text-[12px]">
                  <span className="w-16 shrink-0 tabular-nums text-[#7d8b99]">#{w.number}</span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#39ff88]" />
                  <span className="min-w-0 flex-1 truncate">
                    {w.winner ? <span className="text-[#e8eef4]">@{w.winner}</span> : <span className="text-[#7d8b99]">sealed</span>}{" "}
                    <span className="text-[#39ff88]">{short(w.winning_ticket, 8, 6)}</span>
                  </span>
                  <span className="hidden shrink-0 text-[#4b5763] sm:inline">← {short(w.prev_hash)}</span>
                  <span className="w-10 shrink-0 text-right text-[10px] uppercase text-[#4b5763]">{when(w.ends_at)}</span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#7d8b99]">
                  no student block yet
                </p>
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-[#4b5763]">
                  the first winning ticket is the first line here
                </p>
                <a
                  href="/app/mining"
                  className="mt-4 inline-block border border-[#39ff88] px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#39ff88] hover:bg-[#39ff88] hover:text-[#05070a]"
                >
                  mine the next one →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* the clock — the chain is alive even when nobody is here */}
        <div className="mt-9">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#7d8b99]">the clock</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#4b5763]">last 6 blocks</p>
          </div>
          <div className="mt-3 divide-y divide-white/[0.06] border-y border-white/10">
            {blocks.map((b) => {
              const isOpen = b.status === "open";
              return (
                <div key={b.number} className="flex items-center gap-3 py-2 font-mono text-[11px]">
                  <span className="w-16 shrink-0 tabular-nums text-[#7d8b99]">#{b.number}</span>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isOpen ? "bg-[#ffb347]" : "bg-white/20"}`} />
                  <span className={`min-w-0 flex-1 truncate ${isOpen ? "text-[#ffb347]" : "text-[#4b5763]"}`}>
                    {isOpen ? "open · taking votes" : "sealed · empty"}
                  </span>
                  <span className="w-10 shrink-0 text-right text-[10px] uppercase text-[#4b5763]">{when(b.ends_at)}</span>
                </div>
              );
            })}
            {blocks.length === 0 && (
              <p className="py-6 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[#4b5763]">
                waiting for the first block
              </p>
            )}
          </div>
        </div>

        <p className="mt-6 font-mono text-[10px] leading-relaxed text-[#4b5763]">
          Most blocks are empty on purpose: the clock seals one every two minutes whether or not anyone is here, so an
          empty block is proof the chain was running — not proof someone was. The numbers above are the real ones,
          including the small ones.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <a
            href="/app"
            className="border border-white/20 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#e8eef4] hover:bg-white/5"
          >
            ← open the app
          </a>
          <a
            href="/"
            className="border border-white/20 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#e8eef4] hover:bg-white/5"
          >
            what is physicoin
          </a>
        </div>
      </div>
    </div>
  );
}
