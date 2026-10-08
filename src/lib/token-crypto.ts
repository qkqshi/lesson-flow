import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { requiredEnv } from "@/lib/config";

function encryptionKey(): Buffer {
  const key = Buffer.from(requiredEnv("TOKEN_ENCRYPTION_KEY"), "base64");

  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }

  return key;
}

export function encryptToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptToken(value: string): string {
  const [version, rawIv, rawTag, rawEncrypted, extra] = value.split(".");

  if (version !== "v1" || !rawIv || !rawTag || !rawEncrypted || extra) {
    throw new Error("Unsupported encrypted token format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(rawIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(rawTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(rawEncrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
