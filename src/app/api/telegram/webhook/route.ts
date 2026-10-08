import { z } from "zod";

import { allowedTelegramUserIds, isDemoMode, requiredEnv } from "@/lib/config";
import { sendStartMessage } from "@/lib/telegram-bot";

export const runtime = "nodejs";

const updateSchema = z.object({
  message: z
    .object({
      text: z.string().optional(),
      chat: z.object({ id: z.number().int() }),
      from: z.object({ id: z.number().int() }).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  if (isDemoMode()) {
    return Response.json({ ok: true, skipped: "demo-mode" });
  }

  if (
    request.headers.get("x-telegram-bot-api-secret-token") !==
    requiredEnv("TELEGRAM_WEBHOOK_SECRET")
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return Response.json({ ok: true, skipped: "unsupported-update" });
  }

  const message = parsed.data.message;

  if (
    message?.text?.startsWith("/start") &&
    allowedTelegramUserIds().includes(String(message.from?.id))
  ) {
    await sendStartMessage(String(message.chat.id));
  }

  return Response.json({ ok: true });
}
