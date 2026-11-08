"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { subscribeToNewsletter } from "@/lib/marketing/newsletter";
import { getRequestSite } from "@/lib/sites";

const schema = z.object({
  email: z.string().email("Adresse email invalide"),
  firstName: z.string().max(60).optional(),
  consent: z.literal(true, { message: "Votre consentement est nécessaire pour vous inscrire" }),
  source: z.string().max(40).optional(),
  website: z.string().max(0).optional(), // pot de miel anti-spam
});

export type NewsletterState = { ok?: boolean; error?: string; message?: string };

const attempts = new Map<string, { count: number; reset: number }>();
function rateLimited(key: string, max = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const cur = attempts.get(key);
  if (!cur || cur.reset < now) { attempts.set(key, { count: 1, reset: now + windowMs }); return false; }
  cur.count += 1;
  return cur.count > max;
}

export async function subscribeNewsletterAction(_prev: NewsletterState | undefined, formData: FormData): Promise<NewsletterState> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    firstName: String(formData.get("firstName") ?? "").trim() || undefined,
    consent: formData.get("consent") === "on" ? true : undefined,
    source: String(formData.get("source") ?? "site"),
    website: String(formData.get("website") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (rateLimited(parsed.data.email) || (ip && rateLimited(`ip:${ip}`, 20))) {
    return { error: "Trop de tentatives, réessayez dans quelques minutes." };
  }
  try {
    const site = await getRequestSite();
    const res = await subscribeToNewsletter({ siteId: site.id, email: parsed.data.email, firstName: parsed.data.firstName, source: parsed.data.source, ip });
    if (res.status === "already") return { ok: true, message: "Vous êtes déjà inscrit·e. Merci !" };
    return { ok: true, message: "Presque fini ! Vérifiez votre boîte mail pour confirmer votre inscription." };
  } catch (e) {
    console.error("[newsletter]", e);
    return { error: "Impossible d'enregistrer votre inscription pour le moment." };
  }
}
