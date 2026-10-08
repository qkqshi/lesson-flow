import { createHmac, timingSafeEqual } from "node:crypto";

function signature(value: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

export function createSignedToken(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hash = signature(body, secret).toString("base64url");
  return `${body}.${hash}`;
}

export function readSignedToken(token: string, secret: string): unknown {
  const [body, receivedSignature, extra] = token.split(".");

  if (!body || !receivedSignature || extra) {
    return null;
  }

  const expected = signature(body, secret);
  const actual = Buffer.from(receivedSignature, "base64url");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
