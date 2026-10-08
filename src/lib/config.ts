export const APP_TIME_ZONE = "Europe/Samara";
export const APP_UTC_OFFSET = "+04:00";
export const DEFAULT_NOTIFICATION_TIME = "08:00";
export const SESSION_COOKIE_NAME = "teacher_session";

export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "true") {
    return true;
  }

  if (process.env.DEMO_MODE === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function allowedTelegramUserIds(): string[] {
  const rawIds =
    process.env.ALLOWED_TELEGRAM_USER_IDS?.trim() ||
    process.env.ALLOWED_TELEGRAM_USER_ID?.trim() ||
    (isDemoMode() ? "1" : "");

  if (!rawIds) {
    throw new Error(
      "Missing required environment variable: ALLOWED_TELEGRAM_USER_IDS",
    );
  }

  const ids = [
    ...new Set(
      rawIds
        .split(/[\s,;]+/)
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];

  if (ids.length === 0 || ids.some((id) => !/^\d+$/.test(id))) {
    throw new Error(
      "ALLOWED_TELEGRAM_USER_IDS must contain numeric Telegram IDs separated by commas",
    );
  }

  return ids;
}
