import { currentSchedule } from "@/lib/domains/schedule";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SchedulePage() {
  let data: any = { cells: [], version: null };
  try {
    data = await currentSchedule();
  } catch {
    data = { cells: [], version: null };
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <h1 className="font-display text-3xl font-black tracking-tight">Timetable</h1>
      <p className="mt-1 text-sm text-ink/60">
        The Latin grid <span className="font-mono text-xs">is</span> the timetable. Each round's winning grid becomes the next version —
        chained, scored, and tamper-evident.
      </p>
      <div className="slip mt-5 overflow-hidden p-0">
        <div className="bg-gradient-to-r from-sky/30 via-white to-sky/10 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50">How slips become blocks — nothing destroyed</p>
          <p className="font-display mt-1 text-lg font-bold">Post → Mempool → Mine (lottery) → Block locks slips → Chain</p>
        </div>
        <div className="overflow-x-auto">
          <svg viewBox="0 0 860 140" className="h-[140px] w-[860px] min-w-full" role="img" aria-label="Flowchart: slips are transactions, mining locks them into blocks">
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7dd3fc" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
            </defs>
            {/* boxes */}
            <rect x="14" y="22" width="150" height="64" rx="14" fill="#fffdf7" stroke="#f0e9d8" />
            <text x="89" y="42" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0c1e3a">🛣 ROAD</text>
            <text x="89" y="58" textAnchor="middle" fontSize="10" fill="#0c1e3a" opacity="0.7">Post slip</text>
            <text x="89" y="72" textAnchor="middle" fontSize="9" fill="#0c1e3a" opacity="0.5">physi_events pending</text>

            <rect x="192" y="22" width="150" height="64" rx="14" fill="#f0f9ff" stroke="#bae6fd" strokeDasharray="6 4" />
            <text x="267" y="42" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0c1e3a">MEMPOOL</text>
            <text x="267" y="58" textAnchor="middle" fontSize="10" fill="#0c1e3a" opacity="0.7">12 max / block</text>
            <text x="267" y="72" textAnchor="middle" fontSize="9" fill="#0c1e3a" opacity="0.5">sorted pending ids</text>

            <rect x="370" y="22" width="150" height="64" rx="14" fill="#0c1e3a" stroke="#0369a1" />
            <text x="445" y="42" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fffdf7">⛏ MINING</text>
            <text x="445" y="58" textAnchor="middle" fontSize="10" fill="#fffdf7" opacity="0.8">score ≤ bar → ticket</text>
            <text x="445" y="72" textAnchor="middle" fontSize="9" fill="#fffdf7" opacity="0.6">Argon2id lowest wins</text>

            <rect x="548" y="22" width="150" height="64" rx="14" fill="#fffdf7" stroke="#0369a1" strokeWidth="1.2" />
            <text x="623" y="42" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0c1e3a">⛓ BLOCK</text>
            <text x="623" y="58" textAnchor="middle" fontSize="10" fill="#0c1e3a" opacity="0.7">prev_hash + tx_root</text>
            <text x="623" y="72" textAnchor="middle" fontSize="9" fill="#0c1e3a" opacity="0.5">physi_block_txs</text>

            <rect x="726" y="22" width="120" height="64" rx="14" fill="#15803d" stroke="#15803d" />
            <text x="786" y="42" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">📅 CHAIN</text>
            <text x="786" y="58" textAnchor="middle" fontSize="10" fill="#fff" opacity="0.85">vN grid</text>
            <text x="786" y="72" textAnchor="middle" fontSize="9" fill="#fff" opacity="0.7">tamper-evident</text>

            {/* arrows */}
            <line x1="164" y1="54" x2="192" y2="54" stroke="url(#sg)" strokeWidth="2" markerEnd="url(#arr)" />
            <line x1="342" y1="54" x2="370" y2="54" stroke="#0369a1" strokeWidth="2" />
            <line x1="520" y1="54" x2="548" y2="54" stroke="#0369a1" strokeWidth="2" />
            <line x1="698" y1="54" x2="726" y2="54" stroke="#15803d" strokeWidth="2" />
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#0369a1" />
              </marker>
            </defs>

            {/* caption */}
            <text x="430" y="112" textAnchor="middle" fontSize="11" fill="#0c1e3a" opacity="0.65">Slips are transactions. Mining locks them. Winning tickets chain the timetable.</text>
            <text x="430" y="128" textAnchor="middle" fontSize="9" fill="#0c1e3a" opacity="0.45">Empty block = GENESIS tx_root — chain never stalls, nothing deleted.</text>
          </svg>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-sky/20 bg-white px-4 py-2 font-mono text-[10px] text-ink/60">
          <span className="rounded-full border border-sky/30 bg-sky/10 px-2 py-1">POST /api/timetable</span>
          <span className="rounded-full border border-sky/30 bg-sky/10 px-2 py-1">mine-lottery &lt;bar&gt;</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1">ticket recomputed</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1">prev_hash chain</span>
          <a href="/api/rounds?round=1" className="ml-auto font-bold text-accent hover:underline">Inspect a block →</a>
        </div>
      </div>
      {data.version === null ? (
        <div className="slip mt-6 p-6 pt-8 text-center">
          <p className="font-semibold">No schedule version yet.</p>
          <p className="mt-1 text-sm text-ink/60">Mine a round. The first winner mints v1.</p>
        </div>
      ) : (
        <>
          <p className="mt-3 font-mono text-xs text-ink/50">
            v{data.version} · {data.lattice_order}×{data.lattice_order} · score {data.score} · by {data.winner || "genesis"} · ticket {String(data.ticket).slice(0, 10)}…
          </p>
          <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${data.lattice_order}, minmax(0, 1fr))` }}>
            {data.cells.map((c: any) => (
              <div key={`${c.row}-${c.col}`} className="slip p-3 pt-5 text-center">
                <p className="font-mono text-[10px] text-ink/50">{c.period}</p>
                <p className="font-display text-sm font-bold">{c.hall}</p>
                <p className="font-mono text-[10px] text-ink/60">{c.programme} · {c.level}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
