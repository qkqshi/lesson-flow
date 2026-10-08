import { disconnectGoogleCalendar } from "@/lib/calendar";
import { isDemoMode } from "@/lib/config";
import { errorResponse } from "@/lib/http";
import { requireAppSession } from "@/lib/session";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const session = await requireAppSession();

    if (!isDemoMode()) {
      await disconnectGoogleCalendar(session.telegramId);
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
