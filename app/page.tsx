import { getDb, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function stats(): Promise<{ events: number; verified: number }> {
  if (!isDbConfigured()) return { events: 0, verified: 0 };
  try {
    const sql = getDb();
    const [r] = await sql<{ e: number; v: number }[]>`
      SELECT count(*)::int AS e,
        count(*) FILTER (WHERE status = 'verified')::int AS v
      FROM physi_events`;
    return { events: r.e, verified: r.v };
  } catch {
    return { events: 0, verified: 0 };
  }
}

export default async function Home() {
  const s = await stats();
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-20 text-center sm:pt-28">
      <p className="tnum inline-flex items-center gap-2 rounded-full border border-forest/25 bg-white/80 px-4 py-1.5 text-sm text-ink/80">
        <span className="h-2 w-2 rounded-full bg-forest" />
        {s.events} notices pinned · {s.verified} confirmed by classmates
      </p>
      <h1 className="font-display mx-auto mt-8 max-w-2xl text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
        Never trek to the wrong hall again.
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink/70">
        When a venue moves, someone pins it here. Coursemates tap yes or no —
        eight confirmations turn it into a green tick everyone can trust.
      </p>
      <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a href="/app/roadmap" className="w-full rounded-full bg-ink px-7 py-3.5 font-semibold text-white transition hover:bg-accent sm:w-auto">
          See the live timetable
        </a>
        <a href="/join" className="w-full rounded-full border border-ink/20 bg-white/70 px-7 py-3.5 font-semibold transition hover:border-accent hover:text-accent sm:w-auto">
          Mine your first coin
        </a>
      </div>
      <div className="mx-auto mt-16 grid max-w-2xl gap-4 text-left sm:grid-cols-3">
        {[
          ["Someone posts it", "Venue moved? Pin it in seconds, with the new hall and time."],
          ["The crowd checks it", "Classmates who know tap yes. Whoever doesn't, taps no."],
          ["It turns green", "At eight confirmations the notice locks in for everyone."],
        ].map(([t, d]) => (
          <div key={t} className="slip p-5 pt-6">
            <p className="font-display text-lg font-semibold">{t}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink/70">{d}</p>
          </div>
        ))}
      </div>
      <p className="mt-12 text-sm text-ink/50">
        Anonymous by design — no names on votes, only the crowd's verdict.
      </p>
    </main>
  );
}
