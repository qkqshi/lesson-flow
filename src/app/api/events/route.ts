import {
  createCalendarEvent,
  eventMutationSchema,
  listCalendarEvents,
} from "@/lib/calendar";
import { isDemoMode } from "@/lib/config";
import { createDemoEvent, listDemoEvents } from "@/lib/demo-events";
import { errorResponse } from "@/lib/http";
import { requireAppSession } from "@/lib/session";
import { assertDateString } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireAppSession();
    const rawDate = new URL(request.url).searchParams.get("date") ?? "";
    const date = assertDateString(rawDate);
    const events = isDemoMode()
      ? listDemoEvents(date)
      : await listCalendarEvents(session.telegramId, date);

    return Response.json({ events });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAppSession();
    const input = eventMutationSchema.parse(await request.json());
    const event = isDemoMode()
      ? createDemoEvent(input)
      : await createCalendarEvent(session.telegramId, input);

    return Response.json({ event }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
