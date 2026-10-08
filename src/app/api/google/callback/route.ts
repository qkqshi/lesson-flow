import { NextResponse } from "next/server";

import { exchangeGoogleCode } from "@/lib/calendar";
import { saveGoogleConnection } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { readGoogleOauthState } from "@/lib/session";
import { encryptToken } from "@/lib/token-crypto";

export const runtime = "nodejs";

function resultUrl(request: Request, status: "success" | "error") {
  return new URL("/google/connected?status=" + status, request.url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    if (url.searchParams.get("error")) {
      throw new HttpError(400, "GOOGLE_ACCESS_DENIED", "Google не предоставил доступ.");
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      throw new HttpError(400, "INVALID_GOOGLE_CALLBACK", "Некорректный ответ Google.");
    }

    const oauthState = readGoogleOauthState(state);
    const tokens = await exchangeGoogleCode(code);

    if (!tokens.refresh_token) {
      throw new HttpError(
        400,
        "MISSING_REFRESH_TOKEN",
        "Google не вернул refresh token. Отзовите доступ приложения и подключите календарь снова.",
      );
    }

    await saveGoogleConnection({
      telegramId: oauthState.telegramId,
      encryptedRefreshToken: encryptToken(tokens.refresh_token),
      scopes:
        tokens.scope ?? "https://www.googleapis.com/auth/calendar.events",
    });

    return NextResponse.redirect(resultUrl(request, "success"));
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    return NextResponse.redirect(resultUrl(request, "error"));
  }
}
