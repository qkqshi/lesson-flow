import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  assertAllowedTelegramUser,
  validateTelegramInitData,
} from "@/lib/telegram";

const BOT_TOKEN = "123456:unit-test-token";
const NOW = 1_800_000_000;

function signedInitData(authDate = NOW): string {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    user: JSON.stringify({
      id: 777,
      first_name: "Данил",
      username: "teacher",
    }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => key + "=" + value)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const hash = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");
  params.set("hash", hash);
  return params.toString();
}

describe("validateTelegramInitData", () => {
  it("accepts a fresh, correctly signed payload", () => {
    const user = validateTelegramInitData(signedInitData(), BOT_TOKEN, {
      nowSeconds: NOW,
    });

    expect(user).toMatchObject({
      id: 777,
      first_name: "Данил",
      username: "teacher",
    });
  });

  it("rejects tampered user data", () => {
    const tampered = signedInitData().replace("teacher", "attacker");

    expect(() =>
      validateTelegramInitData(tampered, BOT_TOKEN, { nowSeconds: NOW }),
    ).toThrow("Подпись Telegram");
  });

  it("rejects expired launch data", () => {
    expect(() =>
      validateTelegramInitData(signedInitData(NOW - 4000), BOT_TOKEN, {
        nowSeconds: NOW,
      }),
    ).toThrow("устарели");
  });
});

describe("assertAllowedTelegramUser", () => {
  const user = {
    id: 777,
    first_name: "Данил",
  };

  it("accepts a user present in a multi-admin allowlist", () => {
    expect(() =>
      assertAllowedTelegramUser(user, ["123", "777"]),
    ).not.toThrow();
  });

  it("rejects a user missing from the allowlist", () => {
    expect(() => assertAllowedTelegramUser(user, ["123", "456"])).toThrow(
      "личное приложение",
    );
  });
});
