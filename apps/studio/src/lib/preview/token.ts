/**
 * Liens d'aperçu en lecture seule : jeton signé (HMAC SHA-256, Web Crypto → utilisable dans
 * le middleware edge comme dans Node), valable 7 jours, lié à un livre.
 * Format : <bookId>.<expiration en secondes>.<signature base64url>
 */
export const PREVIEW_TTL_DAYS = 7;

function secret(): string {
  return process.env.PREVIEW_SECRET || process.env.STUDIO_PASSWORD || process.env.INTERNAL_TOKEN || "apercu-local-dev";
}

async function sign(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(`preview:${secret()}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createPreviewToken(bookId: string, opts: { now?: number; days?: number } = {}): Promise<{ token: string; expiresAt: Date }> {
  const exp = Math.floor((opts.now ?? Date.now()) / 1000) + (opts.days ?? PREVIEW_TTL_DAYS) * 86400;
  const body = `${bookId}.${exp}`;
  return { token: `${body}.${await sign(body)}`, expiresAt: new Date(exp * 1000) };
}

/** Vérifie un jeton ; renvoie l'identifiant du livre, ou null (invalide ou expiré). */
export async function verifyPreviewToken(token: string | null | undefined, opts: { now?: number } = {}): Promise<{ bookId: string; expiresAt: Date } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [bookId, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!bookId || !Number.isFinite(exp)) return null;
  if (exp * 1000 < (opts.now ?? Date.now())) return null;
  const expected = await sign(`${bookId}.${expRaw}`);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? { bookId, expiresAt: new Date(exp * 1000) } : null;
}
