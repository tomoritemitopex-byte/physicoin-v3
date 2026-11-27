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
          <p className="kicker text-brick">the campus</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">CAMPUS ROAD.</h1>
          <p className="mt-2 text-[15px] text-ink/65">Tap a building, pick your level, check the notices.</p>
        </div>
      </div>
      <div className="relative min-h-[120vh] overflow-hidden border-[3px] border-ink bg-paper-2 px-2 shadow-brutal">
        <RoadStatic />
        <RoadClient events={events} />
      </div>
      <div className="mt-8">
        <h2 className="font-display text-xl">The campus, drawn.</h2>
        <p className="mt-1 text-sm leading-6 text-ink/70">
          One road, every department. Tap a building on the map above to see the notices for your level.
        </p>
        <div className="mt-4">
          <CampusCanvas />
        </div>
      </div>
    </div>
  );
}
