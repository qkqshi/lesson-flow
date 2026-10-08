import "server-only";

import type { CalendarEventDto } from "@/lib/calendar";
import { APP_TIME_ZONE, requiredEnv } from "@/lib/config";
import { formatTimeInSamara } from "@/lib/time";

type InlineKeyboardButton = {
  text: string;
  web_app?: { url: string };
};

type SendMessageOptions = {
  replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] };
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramBotUser = {
  id: number;
  first_name: string;
  username?: string;
};

type TelegramWebhookInfo = {
  url: string;
  pending_update_count: number;
  last_error_message?: string;
};

async function callTelegramMethod<T>(
  method: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const endpoint =
    "https://api.telegram.org/bot" +
    requiredEnv("TELEGRAM_BOT_TOKEN") +
    "/" +
    method;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as
    | TelegramApiResponse<T>
    | null;

  if (!response.ok || !body?.ok || body.result === undefined) {
    throw new Error(
      "Telegram " +
        method +
        " failed: " +
        (body?.description || "status " + response.status),
    );
  }

  return body.result;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options: SendMessageOptions = {},
): Promise<void> {
  const endpoint =
    "https://api.telegram.org/bot" +
    requiredEnv("TELEGRAM_BOT_TOKEN") +
    "/sendMessage";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: options.replyMarkup,
    }),
  });

  if (!response.ok) {
    throw new Error("Telegram sendMessage failed with status " + response.status);
  }
}

export function dailyScheduleMessage(
  date: string,
  events: CalendarEventDto[],
): string {
  const readableDate = new Intl.DateTimeFormat("ru-RU", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date(date + "T12:00:00+04:00"));

  if (events.length === 0) {
    return "☀️ <b>" + escapeHtml(readableDate) + "</b>\n\nСегодня занятий нет.";
  }

  const lines = events.map((event) => {
    const time = event.allDay
      ? "весь день"
      : formatTimeInSamara(event.start) + "–" + formatTimeInSamara(event.end);
    return "<b>" + time + "</b>  " + escapeHtml(event.title);
  });

  return [
    "☀️ <b>" + escapeHtml(readableDate) + "</b>",
    "",
    ...lines,
    "",
    "Всего занятий: <b>" + events.length + "</b>",
  ].join("\n");
}

export function appButton():
  | { inline_keyboard: InlineKeyboardButton[][] }
  | undefined {
  const appUrl = process.env.APP_URL?.trim();

  if (!appUrl) {
    return undefined;
  }

  return {
    inline_keyboard: [
      [{ text: "Открыть расписание", web_app: { url: appUrl } }],
    ],
  };
}

export async function sendStartMessage(chatId: string): Promise<void> {
  await sendTelegramMessage(
    chatId,
    "<b>Расписание уроков</b>\n\nЗдесь можно посмотреть день, добавить занятие или изменить планы.",
    { replyMarkup: appButton() },
  );
}

export async function configureTelegramBot(): Promise<{
  botUsername: string;
  webhookUrl: string;
  pendingUpdateCount: number;
  lastWebhookError: string | null;
}> {
  const appUrl = requiredEnv("APP_URL").replace(/\/+$/, "");
  const configuredUsername = requiredEnv("TELEGRAM_BOT_USERNAME")
    .replace(/^@/, "")
    .toLocaleLowerCase("en-US");
  const bot = await callTelegramMethod<TelegramBotUser>("getMe");
  const actualUsername = bot.username?.toLocaleLowerCase("en-US");

  if (!actualUsername || actualUsername !== configuredUsername) {
    throw new Error("Configured Telegram bot username does not match the token.");
  }

  const webhookUrl = appUrl + "/api/telegram/webhook";
  await callTelegramMethod<boolean>("setWebhook", {
    url: webhookUrl,
    secret_token: requiredEnv("TELEGRAM_WEBHOOK_SECRET"),
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
  await callTelegramMethod<boolean>("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Расписание",
      web_app: { url: appUrl },
    },
  });

  const webhook = await callTelegramMethod<TelegramWebhookInfo>(
    "getWebhookInfo",
  );

  return {
    botUsername: "@" + actualUsername,
    webhookUrl: webhook.url,
    pendingUpdateCount: webhook.pending_update_count,
    lastWebhookError: webhook.last_error_message ?? null,
  };
}
