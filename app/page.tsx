import Link from "next/link";
import Countdown from "@/components/ui/Countdown";
import { currentRound, leaderboard, barCap } from "@/lib/domains/rounds";
import { listEvents } from "@/lib/domains/events";
import { stats } from "@/lib/domains/misc";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Round = Awaited<ReturnType<typeof currentRound>>;

async function loadLive() {
  const [round, stat, events, leaders] = await Promise.allSettled([
    currentRound(),
    stats(),
    listEvents({ limit: 60 }),
    leaderboard(5),
  ]);
  return {
    round: round.status === "fulfilled" ? (round.value as Round) : null,
    stat: stat.status === "fulfilled" ? stat.value : null,
    events: events.status === "fulfilled" ? events.value : [],
    leaders: leaders.status === "fulfilled" ? (leaders.value as any[]) : [],
  };
}

const steps = [
  {
    n: "01",
    t: "Post the move",
    d: "A hall changes, a lecturer shifts the time, a rep hears it first. Drop it once — it enters the mempool.",
    bg: "brutal-card--lime",
  },
  {
    n: "02",
    t: "Students verify",
    d: "People who were there confirm or reject. Trust is earned per update, not handed out in a group chat.",
    bg: "",
  },
  {
    n: "03",
    t: "The chain locks it",
    d: "The lowest ticket wins the round, the winning grid becomes the next timetable version, the block is chained.",
    bg: "brutal-card--coral",
  },
];

const features = [
  ["LIVE ROAD", "Tap a hall, see the notices, check your level. The campus map is the feed."],
  ["THE GRID", "A 6×6 Latin square — no hall double-booked, no score of zero. The timetable is the proof."],
  ["THE TICKET", "Lowest Argon2id ticket wins, not the best-looking score. Luck is verifiable."],
  ["THE CHAIN", "Every winner carries prev_hash and tx_root. Empty rounds still chain. Nothing quietly disappears."],
];

function Stat({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`border-[3px] border-ink px-4 py-3 ${tone || "bg-white"}`}>
      <p className="kicker text-ink/55">{label}</p>
      <p className="font-display tnum mt-1 text-2xl leading-none sm:text-3xl">{value}</p>
    </div>
  );
}

export default async function LandingPage() {
  const { round, stat, events, leaders } = await loadLive();
  const verified = Number(stat?.events_by_status?.verified ?? 0);
  const totalEvents = Number(stat?.events ?? events.length ?? 0);
  const users = Number(stat?.users ?? 0);
  const mined = Number(stat?.mined ?? 0);
  const bar = round ? barCap(round.lattice_order) : 0;
  const barPct = round && bar ? Math.min(100, Math.max(8, Math.round((1 - round.difficulty / bar) * 100))) : 0;

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* top bar */}
      <header className="border-b-[3px] border-ink bg-paper">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="PhysiCoin home">
            <span className="grid h-10 w-10 place-items-center border-[3px] border-ink bg-lime font-display text-lg shadow-brutal-sm">
              P
            </span>
            <span className="font-display text-lg tracking-tight">PHYSICOIN</span>
            <span className="hidden border-l-2 border-ink/30 pl-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink/50 sm:inline">
              campus signal layer
            </span>
          </Link>
          <nav className="hidden items-center gap-5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] md:flex">
            <Link href="/app/roadmap" className="hover:text-coral">Road</Link>
            <Link href="/app/schedule" className="hover:text-coral">Table</Link>
            <Link href="/app/mining" className="hover:text-coral">Mine</Link>
            <Link href="/app/rounds" className="hover:text-coral">Chain</Link>
          </nav>
          <Link href="/app/board" className="brutal-btn brutal-btn--ink text-[11px]">
            Open the board →
          </Link>
        </div>
      </header>

      {/* marquee */}
      <div className="brutal-marquee" aria-hidden="true">
        <div className="brutal-marquee__track">
          {[0, 1].map((k) => (
            <span key={k} className="inline-flex items-center gap-10">
              <span>● ROUND {round ? `#${round.round}` : "SYNCING"}</span>
              <span>● {round ? `${round.lattice_order}×${round.lattice_order} GRID` : "GRID LOADING"}</span>
              <span>● BAR {round ? round.difficulty : "—"}</span>
              <span>● {verified} VERIFIED SLIPS</span>
              <span>● LOWEST TICKET WINS</span>
              <span>● ADVISORY — NOT OFFICIAL UNIVERSITY COMMUNICATION</span>
            </span>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-[1180px] px-4 sm:px-6">
        {/* hero */}
        <section className="grid gap-10 py-12 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-16">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="brutal-tag brutal-tag--lime">● live feed</span>
              <span className="brutal-tag">{users} wallets</span>
              <span className="brutal-tag">{totalEvents} slips</span>
              <span className="brutal-tag brutal-tag--coral">advisory</span>
            </div>

            <h1 className="mt-6 text-[15vw] leading-[0.86] tracking-[-0.05em] sm:text-[84px] lg:text-[92px]">
              KNOW THE
              <br />
              MOVE
              <br />
              <span className="inline-block border-[3px] border-ink bg-lime px-2 shadow-brutal">BEFORE</span>
              <br />
              YOU MOVE.
            </h1>

            <p className="mt-6 max-w-[540px] text-[15px] leading-7 text-ink/70 sm:text-base">
              PhysiCoin turns the small campus updates that die in group chats into a visible, verifiable feed.
              Post it, let coursemates confirm it, and watch the timetable chain lock the truth in place.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/app/roadmap" className="brutal-btn">
                Enter the live road →
              </Link>
              <Link href="/join" className="brutal-btn brutal-btn--white">
                Create a handle
              </Link>
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink/50">
                no signup wall · advisory by design
              </span>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Wallets" value={users} tone="bg-lime" />
              <Stat label="Slips" value={totalEvents} />
              <Stat label="Verified" value={verified} tone="bg-white" />
              <Stat label="Proofs" value={mined} tone="bg-yellow" />
            </div>
          </div>

          {/* live console */}
          <div className="relative">
            <span className="brutal-sticker absolute -top-4 right-2 z-10">LIVE · ROUND {round ? `#${round.round}` : "—"}</span>
            <div className="console p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="kicker text-lime">current round</p>
                  <p className="font-display tnum mt-1 text-5xl leading-none sm:text-6xl">
                    {round ? `#${round.round}` : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="kicker text-white/50">closes in</p>
                  <p className="font-display tnum mt-1 text-3xl text-lime">
                    {round ? <Countdown seconds={round.ends_in_secs} /> : "—:—"}
                  </p>
                </div>
              </div>

              <div className="mt-5 border-t-2 border-white/20 pt-4">
                <div className="flex items-center justify-between font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
                  <span className="text-white/55">entry bar</span>
                  <span className="text-lime">{round ? `${round.difficulty} / ${bar}` : "—"}</span>
                </div>
                <div className="mt-2 h-3 border-2 border-white/40">
                  <div className="h-full bg-lime" style={{ width: `${barPct}%` }} />
                </div>
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/45">
                  Lower ticket wins at close. Every entry is recomputed server-side — claimed scores are never trusted.
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="border-2 border-white/25 px-3 py-2">
                  <p className="kicker text-white/45">leader</p>
                  <p className="mt-1 truncate font-mono text-xs font-bold text-white">
                    {round?.leader ? `0x${String(round.leader.ticket).slice(0, 10)}…` : "be first"}
                  </p>
                </div>
                <div className="border-2 border-white/25 px-3 py-2">
                  <p className="kicker text-white/45">reward</p>
                  <p className="mt-1 font-mono text-xs font-bold text-lime">+{round?.reward ?? 1} $PHY</p>
                </div>
                <div className="col-span-2 border-2 border-white/25 px-3 py-2">
                  <p className="kicker text-white/45">prev block</p>
                  <p className="mt-1 truncate font-mono text-xs font-bold text-white/85">
                    {round?.prev_hash ? String(round.prev_hash).slice(0, 26) : "GENESIS"}
                  </p>
                </div>
              </div>

              <Link href="/app/mining" className="brutal-btn brutal-btn--coral mt-5 w-full">
                Mine this round →
              </Link>
            </div>
            <p className="mt-3 text-center font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink/45">
              confidence is a live property, not a badge
            </p>
          </div>
        </section>

        {/* protocol */}
        <section className="border-t-[3px] border-ink py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="kicker text-coral">the protocol</p>
              <h2 className="mt-2 text-3xl sm:text-4xl">FROM RUMOUR TO SIGNAL.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-ink/60">
              No pretending the feed is official. No hiding uncertainty. The strength of every update is legible.
            </p>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <article key={s.n} className={`brutal-card ${s.bg} p-5`}>
                <span className="font-mono text-xs font-bold text-ink/50">/{s.n}</span>
                <h3 className="mt-8 text-xl">{s.t}</h3>
                <p className="mt-2 text-sm leading-6 text-ink/70">{s.d}</p>
              </article>
            ))}
          </div>
        </section>

        {/* feature grid */}
        <section className="border-t-[3px] border-ink py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="kicker text-coral">under the hood</p>
              <h2 className="mt-2 text-3xl sm:text-4xl">FOUR THINGS THAT ACTUALLY HOLD.</h2>
            </div>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(([t, d], i) => (
              <article key={t} className={`brutal-card p-4 ${i === 1 ? "brutal-card--lime" : ""}`}>
                <p className="kicker text-ink/50">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-3 text-lg">{t}</h3>
                <p className="mt-2 text-[13px] leading-6 text-ink/70">{d}</p>
              </article>
            ))}
          </div>
        </section>

        {/* leaderboard + doors */}
        <section className="grid gap-4 border-t-[3px] border-ink py-10 lg:grid-cols-[1.1fr_.9fr]">
          <div className="brutal-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="kicker text-coral">top miners</p>
                <h2 className="mt-1 text-2xl">THE BOARD</h2>
              </div>
              <Link href="/app/rounds" className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] underline">
                full chain →
              </Link>
            </div>
            <div className="mt-4 divide-y-2 divide-ink/15 border-y-2 border-ink/20">
              {leaders.length === 0 ? (
                <p className="py-6 text-center font-mono text-xs text-ink/50">
                  No winners yet. Your tap could be the first block.
                </p>
              ) : (
                leaders.map((l, i) => (
                  <div key={`${l.nickname}-${i}`} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-7 w-7 place-items-center border-2 border-ink font-mono text-xs font-bold ${i === 0 ? "bg-lime" : i === 1 ? "bg-white" : i === 2 ? "bg-coral" : "bg-paper-2"}`}>
                        {i + 1}
                      </span>
                      <span className="font-mono text-sm font-bold">@{l.nickname}</span>
                    </div>
                    <span className="font-mono text-[11px] text-ink/55">best {l.best_score}</span>
                    <span className="font-mono text-xs font-bold">
                      {l.wins}W <span className="text-green">+{Number(l.earned).toFixed(2)}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-3">
            <Link href="/app/roadmap" className="brutal-card brutal-card--lime flex items-center justify-between p-5">
              <div>
                <p className="kicker text-ink/55">door one</p>
                <h3 className="mt-1 text-2xl">THE ROAD</h3>
                <p className="mt-1 text-sm text-ink/70">Campus map, hall notices, verify what you see.</p>
              </div>
              <span className="font-display text-4xl">→</span>
            </Link>
            <Link href="/app/mining" className="brutal-card brutal-card--ink flex items-center justify-between p-5">
              <div>
                <p className="kicker text-lime">door two</p>
                <h3 className="mt-1 text-2xl">THE MINE</h3>
                <p className="mt-1 text-sm text-white/60">Grind a ticket, win the round, lock the block.</p>
              </div>
              <span className="font-display text-4xl text-lime">→</span>
            </Link>
            <Link href="/app/schedule" className="brutal-card flex items-center justify-between p-5">
              <div>
                <p className="kicker text-ink/55">the artifact</p>
                <h3 className="mt-1 text-2xl">THE TIMETABLE</h3>
                <p className="mt-1 text-sm text-ink/70">Each winning grid becomes the next version.</p>
              </div>
              <span className="font-display text-4xl">→</span>
            </Link>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t-[3px] border-ink py-7 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink/55">
          <span>PHYSICOIN / campus signal layer</span>
          <span>$PHY has no cash value · advisory, not official · <Link href="/terms" className="underline">terms</Link></span>
        </footer>
      </main>
    </div>
  );
}
