import Link from "next/link";
import { listEvents } from "@/lib/domains/events";
import { getTally } from "@/lib/domains/votes";
import { currentRound } from "@/lib/domains/rounds";
import LiveVote from "@/components/ui/LiveVote";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Campus time, not server time: a 00:30 post in Lagos is still "today".
function todayInLagos(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

// event_date comes back from Postgres as a Date, not a string — never
// String() it, or you get "Fri Nov 2" and every event lands in the wrong bucket.
function dayOf(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  if (iso instanceof Date) return iso.toISOString().slice(0, 10);
  return String(iso).slice(0, 10);
}

function relTime(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const t = iso instanceof Date ? iso.getTime() : Date.parse(String(iso));
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function clock(t: string | null | undefined): string {
  const s = String(t || "").slice(0, 5);
  if (!/^\d\d:\d\d$/.test(s)) return "";
  const h = Number(s.slice(0, 2));
  const m = s.slice(3);
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m}${ampm}`;
}

type Row = {
  id: string;
  title: string;
  venue: string;
  event_date: string | Date;
  event_time: string;
  status: string;
  created_at: string | Date;
  severity: string | null;
  required_points: string | number;
};

function EventRow({ e, showWhen }: { e: Row; showWhen: "now" | "next" | "past" }) {
  const done = e.status === "verified";
  const when =
    showWhen === "now"
      ? clock(e.event_time)
      : showWhen === "past"
        ? relTime(e.created_at)
        : `${dayOf(e.event_date)} · ${clock(e.event_time)}`;
  return (
    <div className="brutal-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display break-words text-[17px] leading-tight">{e.venue}</p>
          <p className="mt-0.5 truncate text-[13px] font-bold text-ink/70">{e.title}</p>
        </div>
        {done ? (
          <span className="shrink-0 border-[3px] border-ink bg-lime px-2 py-1 font-mono text-[10px] font-black uppercase">
            ✓ confirmed
          </span>
        ) : (
          <span className="shrink-0 border-[3px] border-ink bg-white px-2 py-1 font-mono text-[10px] font-black uppercase">
            pending
          </span>
        )}
      </div>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink/65">{when}</p>
    </div>
  );
}

export default async function LivePage() {
  let all: Row[] = [];
  let voteEvent: Row | null = null;
  let tally: any = null;
  let round: any = null;

  try {
    all = (await listEvents({ limit: 60 })) as Row[];
  } catch {
    all = [];
  }
  try {
    const pending = all.filter((e) => e.status === "pending");
    voteEvent = pending[0] ?? null;
    if (voteEvent) tally = await getTally(voteEvent.id);
  } catch {
    voteEvent = null;
    tally = null;
  }
  try {
    round = await currentRound();
  } catch {
    round = null;
  }

  const today = todayInLagos();
  const now = all
    .filter((e) => dayOf(e.event_date) === today)
    .sort((a, b) => String(a.event_time).localeCompare(String(b.event_time)));
  const next = all
    .filter((e) => dayOf(e.event_date) > today)
    .sort((a, b) => `${dayOf(a.event_date)} ${a.event_time}`.localeCompare(`${dayOf(b.event_date)} ${b.event_time}`))
    .slice(0, 5);
  const confirmed = all
    .filter((e) => e.status === "verified")
    .sort((a, b) => {
      const ta = a.created_at instanceof Date ? a.created_at.getTime() : Date.parse(String(a.created_at));
      const tb = b.created_at instanceof Date ? b.created_at.getTime() : Date.parse(String(b.created_at));
      return (tb || 0) - (ta || 0);
    })
    .slice(0, 3);

  const nothingAtAll = all.length === 0;

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-24 pt-6">
      <p className="kicker text-brick">campus live</p>
      <h1 className="mt-1 text-4xl">WHAT MOVED.</h1>
      <p className="mt-2 max-w-[46ch] text-sm leading-6 text-ink/70">
        Say yes if you saw it too — eight classmates turns it green and locks a block.
      </p>

      {/* 1. THE VOTE — the one thing that needs the reader right now */}
      {voteEvent && tally ? (
        <LiveVote event={voteEvent as any} tally={tally} roundNumber={round?.round ?? null} />
      ) : (
        <div className="brutal-card mt-5 p-6 text-center">
          <p className="font-display text-xl">{nothingAtAll ? "NOBODY HAS POSTED YET." : "NOTHING IS WAITING."}</p>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            {nothingAtAll
              ? "Be the first. Post the change you just heard about — the venue, the time, and what you were told."
              : "Every change on the board has been confirmed or dropped. Post the next one."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/app/board" className="brutal-btn">
              Post a venue change →
            </Link>
            <Link href="/app/schedule" className="brutal-btn brutal-btn--white">
              See the timetable
            </Link>
          </div>
        </div>
      )}

      {/* 2. TODAY — what is on, now */}
      {now.length > 0 && (
        <section className="mt-7">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg">HAPPENING TODAY</h2>
            <span className="brutal-tag">{now.length}</span>
          </div>
          <div className="mt-2 space-y-2">
            {now.map((e) => (
              <EventRow key={e.id} e={e} showWhen="now" />
            ))}
          </div>
        </section>
      )}

      {/* 3. NEXT — what is coming */}
      {next.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg">NEXT UP</h2>
            <Link href="/app/schedule" className="font-mono text-[11px] font-bold uppercase underline">
              timetable
            </Link>
          </div>
          <div className="mt-2 space-y-2">
            {next.map((e) => (
              <EventRow key={e.id} e={e} showWhen="next" />
            ))}
          </div>
        </section>
      )}

      {/* 4. PROOF — what the cohort already confirmed, with how long ago */}
      {confirmed.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg">JUST CONFIRMED</h2>
            <Link href="/app/rounds" className="font-mono text-[11px] font-bold uppercase underline">
              the chain
            </Link>
          </div>
          <div className="mt-2 space-y-2">
            {confirmed.map((e) => (
              <EventRow key={e.id} e={e} showWhen="past" />
            ))}
          </div>
        </section>
      )}

      <div className="mt-7 grid gap-2 sm:grid-cols-2">
        <Link href="/app/board" className="brutal-card p-4">
          <p className="kicker text-ink/70">the board</p>
          <p className="mt-1 font-display text-base">post · mempool</p>
        </Link>
        <Link href="/app/rounds" className="brutal-card p-4">
          <p className="kicker text-ink/70">the chain</p>
          <p className="mt-1 font-display text-base">
            {round ? `block #${round.round} open` : "see the blocks"}
          </p>
        </Link>
      </div>

      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.1em] text-ink/65">
        advisory · not official university communication
      </p>
    </div>
  );
}
