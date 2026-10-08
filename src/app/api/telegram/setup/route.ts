import { requiredEnv } from "@/lib/config";
import { configureTelegramBot } from "@/lib/telegram-bot";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expectedAuthorization = "Bearer " + requiredEnv("CRON_SECRET");

  if (request.headers.get("authorization") !== expectedAuthorization) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await configureTelegramBot();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("Telegram setup failed", error);
    return Response.json(
      { ok: false, error: "Telegram setup failed" },
      { status: 502 },
    );
  }
}
