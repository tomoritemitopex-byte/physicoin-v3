import { calendarIcs } from "@/lib/domains/misc";
import { toErrorResponse } from "@/lib/errors";
import { isUuid } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const rawUser = u.searchParams.get("user_id") || "";
    const ics = await calendarIcs({
      user_id: isUuid(rawUser) ? rawUser : undefined,
      programme: u.searchParams.get("programme") || undefined,
      level: u.searchParams.get("level") || undefined,
    });
    return new Response(ics, {
      headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": "attachment; filename=timetable.ics" },
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
