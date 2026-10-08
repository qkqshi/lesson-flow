import {
  deleteCalendarEvent,
  eventMutationSchema,
  updateCalendarEvent,
} from "@/lib/calendar";
import { isDemoMode } from "@/lib/config";
import { deleteDemoEvent, updateDemoEvent } from "@/lib/demo-events";
import { errorResponse } from "@/lib/http";
import { requireAppSession } from "@/lib/session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireAppSession();
    const { eventId } = await context.params;
    const input = eventMutationSchema.parse(await request.json());
    const event = isDemoMode()
      ? updateDemoEvent(eventId, input)
      : await updateCalendarEvent(session.telegramId, eventId, input);

    return Response.json({ event });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireAppSession();
    const { eventId } = await context.params;

    if (isDemoMode()) {
      deleteDemoEvent(eventId);
    } else {
      await deleteCalendarEvent(session.telegramId, eventId);
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
