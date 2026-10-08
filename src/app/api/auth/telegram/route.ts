import { z } from "zod";

import { allowedTelegramUserIds, isDemoMode, requiredEnv } from "@/lib/config";
import { getGoogleConnection, upsertAppUser } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { setAppSession } from "@/lib/session";
import {
  assertAllowedTelegramUser,
  type TelegramUser,
  validateTelegramInitData,
} from "@/lib/telegram";

export const runtime = "nodejs";

const requestSchema = z.object({
  initData: z.string(),
});

const demoUser: TelegramUser = {
  id: 1,
  first_name: "Данил",
  username: "demo_teacher",
};

export async function POST(request: Request) {
  try {
    const { initData } = requestSchema.parse(await request.json());
    const user = isDemoMode()
      ? demoUser
      : validateTelegramInitData(initData, requiredEnv("TELEGRAM_BOT_TOKEN"));

    if (!isDemoMode()) {
      assertAllowedTelegramUser(user, allowedTelegramUserIds());
    }
    await setAppSession(String(user.id), user.first_name);

    if (isDemoMode()) {
      return Response.json({
        user: { firstName: user.first_name },
        googleConnected: false,
        demoMode: true,
      });
    }

    await upsertAppUser(user);
    const googleConnected = Boolean(await getGoogleConnection(String(user.id)));

    return Response.json({
      user: { firstName: user.first_name },
      googleConnected,
      demoMode: false,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
