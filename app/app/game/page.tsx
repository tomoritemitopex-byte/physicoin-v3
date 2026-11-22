import CampusCanvas from "@/components/road/CampusCanvas";
import { listEvents } from "@/lib/domains/events";

export const dynamic = "force-dynamic";

export default async function GamePage() {
  let events: any[] = [];
  try {
    events = await listEvents({ limit: 12 });
  } catch {}
  const verified = events.filter((e) => e.status === "verified").length;
  const pending = events.length - verified;

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-10 sm:px-6">
      {/* HUD */}
      <div className="console sticky top-[74px] z-20 -mx-4 mt-3 px-3 py-3 sm:-mx-6 sm:px-4">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 border-2 border-white/25 px-3 py-1.5">
            <span className="text-lime">◆</span>
            <span className="font-display tnum text-xl text-white">{verified}</span>
            <span className="kicker text-white/50">verified</span>
          </div>
          <div className="flex items-center gap-2 border-2 border-white/25 px-3 py-1.5">
            <span className="text-yellow">◈</span>
            <span className="font-display tnum text-xl text-white">{pending}</span>
            <span className="kicker text-white/50">pending</span>
          </div>
          <div className="flex items-center gap-2 border-2 border-white/25 px-3 py-1.5">
            <span className="text-coral">✦</span>
            <span className="font-display tnum text-xl text-white">{events.length}</span>
            <span className="kicker text-white/50">slips</span>
          </div>
          <div className="ml-auto hidden border-2 border-lime bg-lime px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink sm:block">
            Campus City — build by helping
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="kicker text-coral">the campus game</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">BUILD THE CITY BY FIXING THE TIMETABLE.</h1>
        <p className="mt-3 max-w-[620px] text-sm leading-6 text-ink/65">
          Every verified slip builds a building. Every block builds the chain. Money and help, one tap —
          the mining is invisible.
        </p>
      </div>

      <div className="relative mt-6 overflow-hidden border-[3px] border-ink shadow-brutal">
        <CampusCanvas />
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
          <div className="border-[3px] border-ink bg-paper/95 px-4 py-2">
            <p className="font-display text-sm">Tap a glowing hall to post</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink/55">
              help 8 mates · green tick · +PHY · city grows
            </p>
          </div>
          <div className="ml-auto border-[3px] border-ink bg-lime px-4 py-2 font-display text-sm">
            Game + Money + Help
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="brutal-card brutal-card--lime p-5">
          <p className="kicker text-ink/55">play</p>
          <h3 className="mt-1 text-xl">One hand, 20s</h3>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            Tap your hall, pick the time, pin the slip. Works offline — the queue syncs when you are back.
          </p>
        </div>
        <div className="brutal-card p-5">
          <p className="kicker text-ink/55">earn</p>
          <h3 className="mt-1 text-xl">8 YES = green tick</h3>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            Confirmation pays +PHY and levels up the building. The proof runs behind the post, not in your face.
          </p>
        </div>
        <div className="brutal-card brutal-card--coral p-5">
          <p className="kicker text-ink/55">help</p>
          <h3 className="mt-1 text-xl">Never trek wrong</h3>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            The Road glows where help is needed. You are not farming points — you are saving someone a wasted trip.
          </p>
        </div>
      </div>
    </div>
  );
}
