import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { HttpError } from "@/lib/http";

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
});

export type TelegramUser = z.infer<typeof telegramUserSchema>;

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  options: { maxAgeSeconds?: number; nowSeconds?: number } = {},
): TelegramUser {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const rawUser = params.get("user");

  if (!receivedHash || !/^[a-f\d]{64}$/i.test(receivedHash)) {
    throw new HttpError(401, "INVALID_TELEGRAM_DATA", "Некорректная подпись Telegram.");
  }

  if (!Number.isSafeInteger(authDate) || !rawUser) {
    throw new HttpError(401, "INVALID_TELEGRAM_DATA", "Не хватает данных Telegram.");
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest();
  const actualHash = Buffer.from(receivedHash, "hex");

  if (
    actualHash.length !== expectedHash.length ||
    !timingSafeEqual(actualHash, expectedHash)
  ) {
    throw new HttpError(401, "INVALID_TELEGRAM_DATA", "Подпись Telegram не прошла проверку.");
  }

  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxAgeSeconds = options.maxAgeSeconds ?? 60 * 60;

  if (authDate > nowSeconds + 30 || nowSeconds - authDate > maxAgeSeconds) {
    throw new HttpError(401, "EXPIRED_TELEGRAM_DATA", "Данные запуска Telegram устарели.");
  }

  try {
    return telegramUserSchema.parse(JSON.parse(rawUser));
  } catch {
    throw new HttpError(401, "INVALID_TELEGRAM_USER", "Некорректные данные пользователя Telegram.");
  }
}

export function assertAllowedTelegramUser(
  user: TelegramUser,
  allowedIds: readonly string[],
): void {
  if (!allowedIds.includes(String(user.id))) {
    throw new HttpError(403, "USER_NOT_ALLOWED", "Это личное приложение преподавателя.");
  }
}
