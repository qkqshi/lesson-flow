import { describe, expect, it } from "vitest";

import { createSignedToken, readSignedToken } from "@/lib/signed-token";

describe("signed tokens", () => {
  it("round-trips an authenticated payload", () => {
    const token = createSignedToken({ telegramId: "777" }, "test-secret");
    expect(readSignedToken(token, "test-secret")).toEqual({
      telegramId: "777",
    });
  });

  it("rejects a modified payload", () => {
    const token = createSignedToken({ telegramId: "777" }, "test-secret");
    const [body, signature] = token.split(".");
    const tamperedBody = Buffer.from(
      JSON.stringify({ telegramId: "999" }),
    ).toString("base64url");

    expect(
      readSignedToken(tamperedBody + "." + signature, "test-secret"),
    ).toBeNull();
    expect(body).not.toBe(tamperedBody);
  });
});
