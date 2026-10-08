import { listCalendarEvents } from "@/lib/calendar";
import { allowedTelegramUserIds, isDemoMode, requiredEnv } from "@/lib/config";
import {
  claimDailyNotification,
  completeDailyNotification,
  failDailyNotification,
  getGoogleConnection,
} from "@/lib/db";
import {
  appButton,
  dailyScheduleMessage,
  sendTelegramMessage,
} from "@/lib/telegram-bot";
import { currentDateInSamara } from "@/lib/time";

export const runtime = "nodejs";
export const maxDuration = 60;

type ReminderResult =
  | "sent"
  | "already-processed"
  | "google-not-connected"
  | "failed";

async function sendDailyReminder(
  telegramId: string,
  date: string,
): Promise<ReminderResult> {
  let claimed = false;

  try {
    if (!(await getGoogleConnection(telegramId))) {
      return "google-not-connected";
    }

    claimed = await claimDailyNotification(telegramId, date);

    if (!claimed) {
      return "already-processed";
    }

    const events = await listCalendarEvents(telegramId, date);
    await sendTelegramMessage(telegramId, dailyScheduleMessage(date, events), {
      replyMarkup: appButton(),
    });
    await completeDailyNotification(telegramId, date, events.length);
    return "sent";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown reminder error";

    if (claimed) {
      try {
        await failDailyNotification(telegramId, date, message);
      } catch (persistenceError) {
        console.error("Could not persist reminder failure", persistenceError);
      }
    }

    console.error("Daily reminder failed", error);
    return "failed";
  }
}

async function run(request: Request) {
  if (isDemoMode()) {
    return Response.json({ ok: true, skipped: "demo-mode" });
  }

  const expectedAuthorization = "Bearer " + requiredEnv("CRON_SECRET");

  if (request.headers.get("authorization") !== expectedAuthorization) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = currentDateInSamara();
  const telegramIds = allowedTelegramUserIds();
  const results = await Promise.all(
    telegramIds.map((telegramId) => sendDailyReminder(telegramId, date)),
  );
  const sentCount = results.filter((result) => result === "sent").length;
  const failedCount = results.filter((result) => result === "failed").length;

  return Response.json(
    {
      ok: failedCount === 0,
      date,
      administratorCount: telegramIds.length,
      sentCount,
      skippedCount: results.length - sentCount - failedCount,
      failedCount,
    },
    { status: failedCount > 0 ? 500 : 200 },
  );
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
