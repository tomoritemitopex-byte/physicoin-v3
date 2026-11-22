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
      <p className="kicker text-coral">the artifact</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">THE TIMETABLE.</h1>
      <p className="mt-3 max-w-[560px] text-sm leading-6 text-ink/65">
        The Latin grid <span className="font-mono text-xs font-bold">is</span> the timetable. Each round&apos;s winning
        grid becomes the next version — chained, scored, and tamper-evident.
      </p>

      {data.version === null ? (
        <div className="brutal-card mt-6 p-6 text-center">
          <p className="font-display text-xl">NO VERSION YET.</p>
          <p className="mt-2 text-sm text-ink/60">Mine a round. The first winner mints v1.</p>
          <a href="/app/mining" className="brutal-btn mt-4">Mine the first block →</a>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="brutal-tag brutal-tag--lime">v{data.version}</span>
            <span className="brutal-tag">
              {data.lattice_order}×{data.lattice_order} grid
            </span>
            <span className="brutal-tag">score {data.score}</span>
            <span className="brutal-tag">by {data.winner || "genesis"}</span>
            <span className="brutal-tag brutal-tag--coral">ticket {String(data.ticket).slice(0, 10)}…</span>
          </div>
          <div
            className="mt-5 grid gap-2 border-[3px] border-ink bg-paper-2 p-2 shadow-brutal"
            style={{ gridTemplateColumns: `repeat(${data.lattice_order}, minmax(0, 1fr))` }}
          >
            {data.cells.map((c: any) => (
              <div key={`${c.row}-${c.col}`} className="border-[3px] border-ink bg-white p-2 text-center">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-ink/45">{c.period}</p>
                <p className="font-display mt-1 text-sm leading-none">{c.hall}</p>
                <p className="mt-1 font-mono text-[9px] text-ink/55">
                  {c.programme} · {c.level}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
            every cell is a hall × period pair — no hall double-booked, no zero score
          </p>
        </>
      )}
    </div>
  );
}
