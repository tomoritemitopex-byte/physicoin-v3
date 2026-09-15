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
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="inline-flex items-center gap-2 rounded-full border border-forest/30 bg-white px-3 py-1 font-mono text-xs">
        <span className="h-2 w-2 rounded-full bg-forest" /> live · {s.events} events · {s.verified} verified
      </p>
      <h1 className="mt-6 text-4xl font-black">Never trek to the wrong hall again.</h1>
      <p className="mt-4 text-ink/70">
        Student-powered live timetable. Post a venue change, coursemates vote Yes or No — eight votes
        confirm it with a green tick. Every coin is minted on a real puzzle proof.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <a href="/app/roadmap" className="rounded-full bg-accent px-6 py-3 font-bold text-white">
          See live timetable
        </a>
        <a href="/app/profile" className="rounded-full border border-accent/40 bg-white px-6 py-3 font-bold text-accent">
          Create handle
        </a>
      </div>
      <div className="mx-auto mt-12 grid max-w-lg grid-cols-3 gap-3 text-left">
        {[
          ["1 · Post", "Venue moved? Post it in seconds."],
          ["2 · Vote", "Coursemates tap Yes or No."],
          ["3 · Green tick", "8 votes confirm it for everyone."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-sky/30 bg-white p-4">
            <p className="font-black">{t}</p>
            <p className="mt-1 text-sm text-ink/70">{d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
