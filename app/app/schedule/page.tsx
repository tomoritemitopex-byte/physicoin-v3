import Link from "next/link";
import { currentSchedule } from "@/lib/domains/schedule";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function pretty(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function SchedulePage() {
  let data: any = { cells: [], version: null, pending_swaps: [], pending_count: 0 };
  try {
    data = await currentSchedule();
  } catch {
    data = { cells: [], version: null, pending_swaps: [], pending_count: 0 };
  }
  const swaps: any[] = Array.isArray(data.pending_swaps) ? data.pending_swaps : [];
  const order = Number(data.lattice_order) || 6;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <p className="kicker text-brick">the timetable</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">WHAT&apos;S ON.</h1>
      <p className="mt-3 max-w-[560px] text-sm leading-6 text-ink/70">
        The timetable your cohort agreed on. Every confirmed venue change makes a new version — so nobody can quietly
        move a class and pretend it was always there.
      </p>

      {swaps.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-xl">WAITING FOR A VOTE</h2>
            <span className="brutal-tag brutal-tag--coral">{swaps.length}</span>
          </div>
          <div className="mt-3 space-y-2">
            {swaps.slice(0, 6).map((s) => (
              <div key={s.id} className="brutal-card p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink/65">
                  {s.period}
                  {s.from_venue ? ` · was ${s.from_venue}` : ""}
                  {s.created_at ? ` · ${pretty(s.created_at)}` : ""}
                </p>
                <p className="font-display mt-1 break-words text-[20px] leading-tight">→ {s.venue}</p>
                {s.note && <p className="mt-1 text-sm leading-6 text-ink/70">{s.note}</p>}
              </div>
            ))}
          </div>
          <Link href="/app" className="brutal-btn mt-3 w-full sm:w-auto">
            Vote on what moved →
          </Link>
        </section>
      )}

      {data.version === null ? (
        <div className="brutal-card mt-6 p-6 text-center">
          <p className="font-display text-xl">NO TIMETABLE YET.</p>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            Nothing has been confirmed. Post the first venue change — eight classmates saying yes mints version 1.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/app/board" className="brutal-btn">
              Post a venue change →
            </Link>
            <Link href="/app/mining" className="brutal-btn brutal-btn--white">
              Mine the first block
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="brutal-tag brutal-tag--lime">version {data.version}</span>
            <span className="brutal-tag">
              {order}×{order}
            </span>
            <span className="brutal-tag">score {data.score}</span>
            <span className="brutal-tag">by {data.winner || "genesis"}</span>
          </div>

          <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            <div
              className="grid min-w-[560px] gap-2 border-[3px] border-ink bg-paper-2 p-2 shadow-brutal"
              style={{ gridTemplateColumns: `repeat(${order}, minmax(0, 1fr))` }}
            >
              {data.cells.map((c: any) => (
                <div key={`${c.row}-${c.col}`} className="border-[3px] border-ink bg-white p-2 text-center">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink/65">{c.period}</p>
                  <p className="font-display mt-1 truncate text-[13px] leading-tight" title={c.hall}>
                    {c.hall}
                  </p>
                  <p className="mt-1 truncate font-mono text-[10px] text-ink/65">{c.level}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/65 sm:hidden">swipe the grid →</p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/65">
            one hall per period · no double-booking
          </p>
        </>
      )}
    </div>
  );
}
