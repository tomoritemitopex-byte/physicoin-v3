import CampusCanvas from "@/components/road/CampusCanvas";
import { listEvents } from "@/lib/domains/events";

export const dynamic = "force-dynamic";

export default async function GamePage() {
  let events: any[] = [];
  try { events = await listEvents({ limit: 12 }); } catch {}
  const verified = events.filter(e => e.status === "verified").length;
  const pending = events.length - verified;
  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-10">
      {/* Game HUD — Tailwind overlay, Elvenar style, but for Physicoin */}
      <div className="sticky top-0 z-20 -mx-4 bg-slate-900/95 backdrop-blur border-b border-cyan-400/20 px-4 py-3">
        <div className="max-w-[1280px] mx-auto flex gap-3">
          <div className="bg-slate-800 border border-amber-400/30 rounded-2xl px-5 py-2 flex items-center gap-2">
            <span className="text-amber-400">◆</span><span className="text-white font-black">{verified}</span><span className="text-white/50 text-xs">Verified</span>
          </div>
          <div className="bg-slate-800 border border-cyan-400/30 rounded-2xl px-5 py-2 flex items-center gap-2">
            <span className="text-cyan-400">◈</span><span className="text-white font-black">{pending}</span><span className="text-white/50 text-xs">Pending</span>
          </div>
          <div className="bg-slate-800 border border-violet-400/30 rounded-2xl px-5 py-2 flex items-center gap-2">
            <span className="text-violet-400">✦</span><span className="text-white font-black">{events.length}</span><span className="text-white/50 text-xs">Slips</span>
          </div>
          <div className="ml-auto bg-cyan-500 text-slate-900 rounded-2xl px-6 py-2 font-black hidden sm:block">Campus City — Build by Helping</div>
        </div>
      </div>

      <div className="mt-4">
        <h1 className="font-display text-3xl font-black tracking-tight">Physicoin — The Campus Game</h1>
        <p className="mt-1 text-ink/60">Build your city by fixing the timetable. Every verified slip builds a building. Every block builds the chain. Money and help, one tap.</p>
      </div>

      {/* Elvenar City — HTML5 Canvas, Y-sorted, Bend parallel */}
      <div className="mt-6 relative overflow-hidden rounded-3xl border border-cyan-400/20 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
        <CampusCanvas />
        <div className="absolute bottom-3 left-3 right-3 flex gap-2">
          <div className="bg-slate-900/80 backdrop-blur rounded-xl px-4 py-2 border border-white/10">
            <p className="text-white font-bold text-sm">Tap a glowing hall to post</p><p className="text-white/60 text-xs">Help 8 mates, green tick, +PHY, city grows</p>
          </div>
          <div className="ml-auto bg-amber-500 text-slate-900 rounded-xl px-4 py-2 font-black text-sm">Game + Money + Help</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="slip p-5"><h3 className="font-display font-bold">Play</h3><p className="mt-1 text-sm text-ink/60">Tap your hall, pick time, pin the slip — 20s, one hand, offline.</p></div>
        <div className="slip p-5"><h3 className="font-display font-bold">Earn</h3><p className="mt-1 text-sm text-ink/60">8 YES = green tick = +PHY + city building levels up. Mining is invisible.</p></div>
        <div className="slip p-5"><h3 className="font-display font-bold">Help</h3><p className="mt-1 text-sm text-ink/60">No more trek to wrong hall. The Road glows where help is needed.</p></div>
      </div>
    </div>
  );
}
