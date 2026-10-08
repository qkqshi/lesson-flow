import { randomBytes } from "node:crypto";

import { createGoogleAuthorizationUrl } from "@/lib/calendar";
import { isDemoMode } from "@/lib/config";
import { getGoogleConnection } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { createGoogleOauthState, requireAppSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireAppSession();

    if (isDemoMode()) {
      return Response.json({ connected: false, demoMode: true, url: null });
    }

    const connected = Boolean(await getGoogleConnection(session.telegramId));

    if (connected) {
      return Response.json({ connected: true, demoMode: false, url: null });
    }

    const state = createGoogleOauthState(
      session.telegramId,
      randomBytes(16).toString("hex"),
    );

    return Response.json({
      connected: false,
      demoMode: false,
      url: createGoogleAuthorizationUrl(state),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
