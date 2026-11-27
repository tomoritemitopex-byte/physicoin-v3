import Link from "next/link";
import { listEvents } from "@/lib/domains/events";
import { getTally } from "@/lib/domains/votes";
import { currentRound } from "@/lib/domains/rounds";
import LiveVote from "@/components/ui/LiveVote";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LivePage() {
  let event: any = null;
  let tally: any = null;
  let round: any = null;

  try {
    const pending = await listEvents({ status: "pending", limit: 1 });
    event = pending[0] ?? null;
    if (event) tally = await getTally(event.id);
  } catch {
    event = null;
  }
  try {
    round = await currentRound();
  } catch {
    round = null;
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-24 pt-6">
      <p className="kicker text-ink/70">campus live</p>
      <h1 className="mt-1 text-4xl">WHAT MOVED.</h1>
      <p className="mt-2 max-w-[46ch] text-sm leading-6 text-ink/70">
        One change at a time. Say yes if you saw it too — eight classmates turns it green and locks a block.
      </p>

      {event && tally ? (
        <LiveVote event={event} tally={tally} roundNumber={round?.round ?? null} />
      ) : (
        <div className="brutal-card mt-5 p-6 text-center">
          <p className="font-display text-xl">NOTHING MOVED YET.</p>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            No venue change is waiting for a vote. Post what you heard — the next confirmed change rides into an
            open block.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/app/board" className="brutal-btn">
              Post a venue change →
            </Link>
            <Link href="/app/mining" className="brutal-btn brutal-btn--white">
              Mine a block →
            </Link>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Link href="/app/board" className="brutal-card p-4">
          <p className="kicker text-ink/70">the board</p>
          <p className="mt-1 font-display text-base">post · mempool</p>
        </Link>
        <Link href="/app/rounds" className="brutal-card p-4">
          <p className="kicker text-ink/70">the chain</p>
          <p className="mt-1 font-display text-base">
            {round ? `round ${round.round} open` : "see the blocks"}
          </p>
        </Link>
      </div>

      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.1em] text-ink/60">
        advisory · not official university communication
      </p>
    </div>
  );
}
