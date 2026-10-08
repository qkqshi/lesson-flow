import { afterEach, describe, expect, it } from "vitest";

import { allowedTelegramUserIds } from "@/lib/config";

const originalPlural = process.env.ALLOWED_TELEGRAM_USER_IDS;
const originalSingular = process.env.ALLOWED_TELEGRAM_USER_ID;

afterEach(() => {
  if (originalPlural === undefined) {
    delete process.env.ALLOWED_TELEGRAM_USER_IDS;
  } else {
    process.env.ALLOWED_TELEGRAM_USER_IDS = originalPlural;
  }

  if (originalSingular === undefined) {
    delete process.env.ALLOWED_TELEGRAM_USER_ID;
  } else {
    process.env.ALLOWED_TELEGRAM_USER_ID = originalSingular;
  }
});

describe("allowedTelegramUserIds", () => {
  it("parses and deduplicates a multi-admin allowlist", () => {
    process.env.ALLOWED_TELEGRAM_USER_IDS = "1745802625, 6298453158;1745802625";

    expect(allowedTelegramUserIds()).toEqual(["1745802625", "6298453158"]);
  });

  it("keeps the singular environment variable backwards compatible", () => {
    delete process.env.ALLOWED_TELEGRAM_USER_IDS;
    process.env.ALLOWED_TELEGRAM_USER_ID = "1745802625";

    expect(allowedTelegramUserIds()).toEqual(["1745802625"]);
  });

  it("rejects malformed Telegram IDs", () => {
    process.env.ALLOWED_TELEGRAM_USER_IDS = "1745802625,not-an-id";

    expect(() => allowedTelegramUserIds()).toThrow("numeric Telegram IDs");
  });
});
