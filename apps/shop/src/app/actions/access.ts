"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { createAccessLink } from "@/lib/orders/access";
import { brandForEmail } from "@/lib/orders/notify";
import { sendEmail } from "@/lib/email";
import { accessLinkEmail } from "@/lib/email/templates";
import { getSetting } from "@/lib/settings";
import { getRequestSite } from "@/lib/sites";

export type AccessState = { ok?: boolean; error?: string; message?: string };

const attempts = new Map<string, { count: number; reset: number }>();
function rateLimited(key: string, max: number, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const cur = attempts.get(key);
  if (!cur || cur.reset < now) { attempts.set(key, { count: 1, reset: now + windowMs }); return false; }
  cur.count += 1;
  return cur.count > max;
}

const NEUTRAL = "Si des achats sont associés à cette adresse, un email contenant votre lien d'accès vient de vous être envoyé.";

export async function requestAccessLinkAction(_prev: AccessState | undefined, formData: FormData): Promise<AccessState> {
  const parsed = z.string().email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Adresse email invalide." };
  if (String(formData.get("website") ?? "")) return { ok: true, message: NEUTRAL };
  const email = parsed.data;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (rateLimited(`email:${email}`, 3) || (ip && rateLimited(`ip:${ip}`, 15))) {
    return { ok: true, message: NEUTRAL };
  }
  try {
    const site = await getRequestSite();
    const commerce = await getSetting("commerce", site);
    const brand = await brandForEmail(site.id);
    const link = await createAccessLink(email, commerce.downloadLinkValidityHours, undefined, brand.appUrl);
    if (link) {
      await sendEmail({ to: email, ...accessLinkEmail(brand, { accessUrl: link.url, expiresHours: commerce.downloadLinkValidityHours }) });
    }
  } catch (e) {
    console.error("[access-link]", e);
  }
  return { ok: true, message: NEUTRAL };
}
