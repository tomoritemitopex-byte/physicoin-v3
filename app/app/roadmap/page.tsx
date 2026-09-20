import RoadStatic from "@/components/road/RoadStatic";
import RoadClient from "@/components/road/RoadClient";
import CampusCanvas from "@/components/road/CampusCanvas";
import { listEvents } from "@/lib/domains/events";

// Live feed every request: events change by the minute, never cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RoadmapPage() {
  let events: any[] = [];
  try {
    events = await listEvents({ limit: 60 });
  } catch {
    events = [];
  }
  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-2 py-5">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight">Campus Road</h1>
          <p className="mt-1 text-[15px] text-ink/60">Tap a building, pick your level, check the notices.</p>
        </div>
      </div>
      <div className="relative min-h-[120vh] overflow-hidden rounded-3xl bg-gradient-to-b from-sky to-green-50 px-2">
        <RoadStatic />
        <RoadClient events={events} />
      </div>
      <div className="mt-8">
        <h2 className="font-display text-xl font-bold">Campus City — Elvenar Face, Physicoin Heart</h2>
        <p className="mt-1 text-sm text-ink/60">HTML5 Canvas + Y-sorted sprites — the timetable as a glowing city. Bend chose JS for web, C for native, one engine.</p>
        <div className="mt-4">
          <CampusCanvas />
        </div>
      </div>
    </div>
  );
}
