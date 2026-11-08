import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Chiffrement symétrique (AES-256-GCM) des jetons d'accès des réseaux sociaux.
 * Clé dérivée de MARKETING_ENCRYPTION_KEY (recommandé) ou, à défaut, d'AUTH_SECRET.
 */
function key(): Buffer {
  const secret = process.env.MARKETING_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) throw new Error("MARKETING_ENCRYPTION_KEY ou AUTH_SECRET requis pour chiffrer les jetons");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const [v, ivB64, tagB64, dataB64] = payload.split(".");
  if (v !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("Jeton chiffré invalide");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
}

/** Hachage SHA-256 normalisé (emails pour les API de conversion). */
export function sha256Normalized(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}
