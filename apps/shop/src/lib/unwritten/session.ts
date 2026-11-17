import "server-only";
import { cookies, headers } from "next/headers";
import { env } from "@/lib/env";
import { DRAFTS_COOKIE, REF_COOKIE, sanitizeRef } from "./constants";
import { readDraftsCookie, signDraftsCookie } from "./tokens";

/** Brouillons rattachés à ce navigateur (cookie httpOnly signé, jamais lisible par un script). */
export async function cookieDraftIds(): Promise<string[]> {
  return readDraftsCookie((await cookies()).get(DRAFTS_COOKIE)?.value);
}

async function writeIds(ids: string[], days: number) {
  const jar = await cookies();
  if (!ids.length) {
    jar.delete(DRAFTS_COOKIE);
    return;
  }
  jar.set(DRAFTS_COOKIE, signDraftsCookie(ids, days), { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", maxAge: days * 86400 });
}

export async function rememberDraft(id: string, days: number) {
  const ids = (await cookieDraftIds()).filter((x) => x !== id);
  await writeIds([...ids, id], days);
}

export async function forgetDraft(id: string, days = 30) {
  await writeIds((await cookieDraftIds()).filter((x) => x !== id), days);
}

export async function ownsDraft(id: string): Promise<boolean> {
  return (await cookieDraftIds()).includes(id);
}

/** Paramètre `ref` mémorisé par le proxy (attribution jusqu'au paiement). */
export async function currentRef(): Promise<string | null> {
  return sanitizeRef((await cookies()).get(REF_COOKIE)?.value);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64);
}
