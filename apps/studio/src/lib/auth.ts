/**
 * Protection du studio par mot de passe partagé (STUDIO_PASSWORD).
 * Sans STUDIO_PASSWORD, aucune protection (développement local).
 * Implémenté avec Web Crypto pour fonctionner dans le middleware (edge) et dans Node.
 */
export const SESSION_COOKIE = "studio_session";
const SESSION_MESSAGE = "inventor-studio-session-v1";

export function isAuthEnabled(): boolean {
  return Boolean(process.env.STUDIO_PASSWORD && process.env.STUDIO_PASSWORD.length >= 8);
}

async function hmac(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Valeur attendue du cookie de session pour le mot de passe courant. */
export async function expectedSessionToken(): Promise<string | null> {
  if (!isAuthEnabled()) return null;
  return hmac(process.env.STUDIO_PASSWORD as string, SESSION_MESSAGE);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(cookieValue: string | undefined | null): Promise<boolean> {
  if (!isAuthEnabled()) return true;
  if (!cookieValue) return false;
  const expected = await expectedSessionToken();
  return !!expected && constantTimeEqual(cookieValue, expected);
}

export function isValidPassword(candidate: string): boolean {
  const pwd = process.env.STUDIO_PASSWORD ?? "";
  return pwd.length >= 8 && constantTimeEqual(candidate, pwd);
}

/** Le worker et Chromium passent par le jeton interne (query `token` ou en-tête `x-internal-token`). */
export function hasInternalToken(req: { headers: Headers; nextUrl?: { searchParams: URLSearchParams } }): boolean {
  const expected = process.env.INTERNAL_TOKEN;
  if (!expected || expected === "change-me") return false;
  const header = req.headers.get("x-internal-token");
  const query = req.nextUrl?.searchParams.get("token");
  return header === expected || query === expected;
}
