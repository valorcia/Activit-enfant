import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { env } from "@/lib/env";

/** Jeton aléatoire opaque (liens de téléchargement, accès client, API). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Signature HMAC d'une charge utile courte, avec expiration. */
export function signPayload(payload: string, expiresAtSec: number, secret = env.downloadTokenSecret): string {
  const data = `${payload}.${expiresAtSec}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${expiresAtSec}.${sig}`;
}

export function verifySignedPayload(token: string, secret = env.downloadTokenSecret, now = Math.floor(Date.now() / 1000)): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [payloadB64, expStr, sig] = parts;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return null;
  const payload = Buffer.from(payloadB64, "base64url").toString();
  const expected = createHmac("sha256", secret).update(`${payload}.${expiresAt}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}
