"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CATALOG_TAG } from "@/lib/catalog";
import { getStorage } from "@/lib/storage";
import { fail, handleActionError, succeed, type ActionResult } from "@/lib/admin/action-result";
import { consumeLoginToken } from "@/lib/creators/auth";
import { CONTRACT_VERSION } from "@/lib/creators/contract";
import { encryptIban } from "@/lib/creators/iban";
import { notifyTeam, sendCreatorLoginLink } from "@/lib/creators/notify";
import { approvePreview, uniqueCreatorSlug } from "@/lib/creators/service";
import { assertCreator, clearCreatorSessionCookie, setCreatorSessionCookie } from "@/lib/creators/session";
import { EDITABLE_STATUSES, creatorPhotoFolder, submissionInputSchema, submitProblems } from "@/lib/creators/submissions";

export type CreatorFormState = { ok?: boolean; error?: string; message?: string };

const attempts = new Map<string, { count: number; reset: number }>();
function rateLimited(key: string, max: number, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const cur = attempts.get(key);
  if (!cur || cur.reset < now) { attempts.set(key, { count: 1, reset: now + windowMs }); return false; }
  cur.count += 1;
  return cur.count > max;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64);
}

const NEUTRAL = "Si cette adresse correspond à un compte créatrice, un lien de connexion vient de vous être envoyé.";

/** Demande d'un lien magique (réponse neutre : on ne révèle pas si l'adresse existe). */
export async function requestCreatorLinkAction(_prev: CreatorFormState | undefined, formData: FormData): Promise<CreatorFormState> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Adresse e-mail invalide." };
  if (String(formData.get("website") ?? "")) return { ok: true, message: NEUTRAL };
  const ip = await clientIp();
  if (rateLimited(`creator-email:${parsed.data}`, 3) || (ip && rateLimited(`creator-ip:${ip}`, 15))) return { ok: true, message: NEUTRAL };
  try {
    const creator = await prisma.creator.findUnique({ where: { email: parsed.data }, select: { id: true, email: true, status: true } });
    if (creator && creator.status !== "SUSPENDED") await sendCreatorLoginLink(creator);
  } catch (e) {
    console.error("[creator-link]", e instanceof Error ? e.message : e);
  }
  return { ok: true, message: NEUTRAL };
}

/** Connexion par lien magique (bouton : évite qu'un antivirus de messagerie consomme le lien en l'ouvrant). */
export async function loginCreatorAction(_prev: CreatorFormState | undefined, formData: FormData): Promise<CreatorFormState> {
  const token = String(formData.get("jeton") ?? "");
  const ip = await clientIp();
  if (ip && rateLimited(`creator-login:${ip}`, 30)) return { error: "Trop de tentatives : réessayez dans quelques minutes." };
  const res = await consumeLoginToken(token);
  if (!res.ok) {
    return { error: res.reason === "suspended" ? "Votre compte est suspendu : contactez-nous." : res.reason === "used" ? "Ce lien a déjà servi. Demandez un nouveau lien ci-dessous." : "Ce lien est invalide ou a expiré. Demandez un nouveau lien ci-dessous." };
  }
  await setCreatorSessionCookie(res.sessionToken);
  redirect(res.creator.contractVersion === CONTRACT_VERSION ? "/espace-createur" : "/espace-createur/contrat");
}

export async function logoutCreatorAction() {
  await clearCreatorSessionCookie();
  redirect("/espace-createur/connexion");
}

export async function acceptContractAction(_prev: CreatorFormState | undefined, formData: FormData): Promise<CreatorFormState> {
  try {
    const creator = await assertCreator();
    if (formData.get("accept") !== "on") return { error: "Cochez la case pour accepter le contrat." };
    if (String(formData.get("version") ?? "") !== CONTRACT_VERSION) return { error: "Le contrat a été mis à jour : rechargez la page pour lire la nouvelle version." };
    await prisma.creator.update({
      where: { id: creator.id },
      data: { contractVersion: CONTRACT_VERSION, contractAcceptedAt: new Date(), contractAcceptedIp: (await clientIp()) || null, status: creator.status === "INVITED" ? "ACTIVE" : creator.status },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur" };
  }
  redirect("/espace-createur/profil?bienvenue=1");
}

const profileSchema = z.object({
  publicName: z.string().trim().min(2, "Pseudo trop court").max(40, "Pseudo trop long (40 caractères)"),
  bio: z.string().trim().max(600, "Présentation trop longue (600 caractères)").optional().default(""),
  photo: z.object({ url: z.string().max(600), key: z.string().max(400) }).nullable().optional(),
  iban: z.string().trim().max(50).optional().default(""),
  ibanHolder: z.string().trim().max(120).optional().default(""),
});

export async function updateCreatorProfileAction(raw: unknown): Promise<ActionResult<{ slug: string; ibanLast4: string | null }>> {
  try {
    const creator = await assertCreator({ contract: true });
    const input = profileSchema.parse(raw);
    if (input.photo && !input.photo.key.startsWith(`public/creators/${creator.id}/`)) return fail("Photo de profil invalide");
    const data: Prisma.CreatorUpdateInput = {
      publicName: input.publicName,
      bio: input.bio || null,
      slug: await uniqueCreatorSlug(input.publicName, creator.id),
    };
    // URL recalculée côté serveur à partir de la clé (jamais celle envoyée par le navigateur)
    if (input.photo !== undefined) { data.photoUrl = input.photo ? getStorage().publicUrl(input.photo.key) : null; data.photoKey = input.photo?.key ?? null; }
    if (input.iban) {
      if (!input.ibanHolder) return fail("Indiquez le titulaire du compte", { ibanHolder: ["Titulaire requis"] });
      try { Object.assign(data, encryptIban(input.iban)); } catch (e) { return fail(e instanceof Error ? e.message : "IBAN invalide", { iban: ["IBAN invalide"] }); }
    }
    if (input.ibanHolder) data.ibanHolder = input.ibanHolder;
    const updated = await prisma.creator.update({ where: { id: creator.id }, data, select: { slug: true, ibanLast4: true } });
    revalidateTag(CATALOG_TAG, "max");
    revalidatePath("/espace-createur", "layout");
    return succeed({ slug: updated.slug ?? "", ibanLast4: updated.ibanLast4 });
  } catch (e) { return handleActionError(e); }
}

/** Enregistre une proposition (brouillon) et, si demandé, l'envoie en modération. */
export async function saveSubmissionAction(id: string | null, raw: unknown, submit: boolean): Promise<ActionResult<{ id: string; status: string }>> {
  try {
    const creator = await assertCreator({ contract: true });
    if (creator.status !== "ACTIVE") return fail("Votre compte n'est pas actif");
    const input = submissionInputSchema.parse(raw);
    const folder = creatorPhotoFolder(creator.id);
    if (input.photos.some((p) => !p.key.startsWith(folder) || p.key.includes(".."))) return fail("Une photo ne vous appartient pas : renvoyez-la");
    if (submit) {
      const problems = submitProblems(input);
      if (problems.length) return fail(problems.join(" "));
    }
    const existing = id ? await prisma.creatorSubmission.findFirst({ where: { id, creatorId: creator.id } }) : null;
    if (id && !existing) return fail("Proposition introuvable");
    if (existing && !EDITABLE_STATUSES.includes(existing.status)) return fail("Cette proposition ne peut plus être modifiée");
    const data = {
      title: input.title,
      ageMin: input.ageMin ?? null,
      ageMax: input.ageMax ?? null,
      durationMinutes: input.durationMinutes ?? null,
      materials: input.materials,
      steps: input.steps,
      tips: input.tips || null,
      safetyNotes: input.safetyNotes || null,
      photos: input.photos as unknown as Prisma.InputJsonValue,
      contribution: input.contribution,
      exclusive: input.exclusive,
      ...(submit ? { status: "SUBMITTED" as const, submittedAt: new Date() } : {}),
    };
    const saved = existing
      ? await prisma.creatorSubmission.update({ where: { id: existing.id }, data })
      : await prisma.creatorSubmission.create({ data: { ...data, creatorId: creator.id } });
    if (submit) {
      try { await notifyTeam("Nouvelle idée à modérer", `« ${saved.title} » vient d'être ${existing?.status === "CHANGES_REQUESTED" ? "modifiée et renvoyée" : "proposée"} par ${creator.publicName ?? "une créatrice"}.`, `/admin/createurs/moderation/${saved.id}`); } catch { /* facultatif */ }
    }
    revalidatePath("/espace-createur", "layout");
    revalidatePath("/admin/createurs/moderation");
    return succeed({ id: saved.id, status: saved.status });
  } catch (e) { return handleActionError(e); }
}

export async function deleteSubmissionAction(id: string): Promise<ActionResult<undefined>> {
  try {
    const creator = await assertCreator();
    const sub = await prisma.creatorSubmission.findFirst({ where: { id, creatorId: creator.id } });
    if (!sub) return fail("Proposition introuvable");
    if (sub.status !== "DRAFT") return fail("Seul un brouillon peut être supprimé");
    await prisma.creatorSubmission.delete({ where: { id } });
    revalidatePath("/espace-createur", "layout");
    return succeed(undefined);
  } catch (e) { return handleActionError(e); }
}

export async function approvePreviewAction(id: string): Promise<ActionResult<{ status: string }>> {
  try {
    const creator = await assertCreator({ contract: true });
    const sub = await approvePreview(id, creator.id);
    revalidatePath("/espace-createur", "layout");
    revalidatePath("/admin/createurs/moderation");
    return succeed({ status: sub.status });
  } catch (e) { return handleActionError(e); }
}
