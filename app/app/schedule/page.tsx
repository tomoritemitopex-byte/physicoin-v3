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
