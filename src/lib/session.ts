import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { SESSION_COOKIE_NAME, isDemoMode, requiredEnv } from "@/lib/config";
import { HttpError } from "@/lib/http";
import { createSignedToken, readSignedToken } from "@/lib/signed-token";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const sessionSchema = z.object({
  telegramId: z.string().min(1),
  firstName: z.string().min(1),
  expiresAt: z.number().int(),
  purpose: z.literal("session"),
});

const oauthStateSchema = z.object({
  telegramId: z.string().min(1),
  expiresAt: z.number().int(),
  purpose: z.literal("google-oauth"),
  nonce: z.string().min(16),
});

export type AppSession = z.infer<typeof sessionSchema>;

function sessionSecret(): string {
  if (isDemoMode() && !process.env.SESSION_SECRET?.trim()) {
    return "local-demo-session-secret-do-not-use-in-production";
  }

  return requiredEnv("SESSION_SECRET");
}

export async function setAppSession(
  telegramId: string,
  firstName: string,
): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const token = createSignedToken(
    { telegramId, firstName, expiresAt, purpose: "session" },
    sessionSecret(),
  );
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function requireAppSession(): Promise<AppSession> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = token
    ? sessionSchema.safeParse(readSignedToken(token, sessionSecret()))
    : null;

  if (
    !parsed?.success ||
    parsed.data.expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    throw new HttpError(401, "UNAUTHENTICATED", "Откройте приложение заново через Telegram.");
  }

  return parsed.data;
}

export function createGoogleOauthState(
  telegramId: string,
  nonce: string,
): string {
  return createSignedToken(
    {
      telegramId,
      nonce,
      purpose: "google-oauth",
      expiresAt: Math.floor(Date.now() / 1000) + 10 * 60,
    },
    sessionSecret(),
  );
}

export function readGoogleOauthState(token: string) {
  const parsed = oauthStateSchema.safeParse(
    readSignedToken(token, sessionSecret()),
  );

  if (
    !parsed.success ||
    parsed.data.expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    throw new HttpError(400, "INVALID_OAUTH_STATE", "Ссылка подключения Google устарела.");
  }

  return parsed.data;
}
