import RoadStatic from "@/components/road/RoadStatic";
import RoadClient from "@/components/road/RoadClient";
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
      <h1 className="py-4 text-xl font-black">Campus Road</h1>
      <div className="relative min-h-[120vh] overflow-hidden rounded-3xl bg-gradient-to-b from-sky to-green-50 px-2">
        <RoadStatic />
        <RoadClient events={events} />
      </div>
    </div>
  );
}
