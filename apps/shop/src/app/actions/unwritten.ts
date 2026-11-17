"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CheckoutError, createCheckoutSession } from "@/lib/orders/checkout";
import { verifyOrderAccessToken } from "@/lib/orders/access";
import { isStripeConfigured } from "@/lib/stripe";
import { brandConfig, brandCurrency, brandHref, brandUrl, getRequestBrand, openLocales } from "@/lib/unwritten/brand";
import { isLocale, type Locale } from "@/lib/unwritten/constants";
import {
  consumeResumeToken, deleteDraft, DraftError, freezeDraftForCheckout, getDraft, issueResumeLink, releaseDraft,
  saveDraftStep, setDraftMode, startDraft, draftDefinition, draftAnswers, type DraftWithRefs,
} from "@/lib/unwritten/drafts";
import { fill, getDictionary } from "@/lib/unwritten/i18n";
import { href } from "@/lib/unwritten/i18n/routing";
import { sendResumeLinkEmail } from "@/lib/unwritten/notify";
import { completeGift, findGiftByToken, PersonalItemError, rotateGiftToken, saveGiftStep, combinedGiftAnswers, itemDefinition } from "@/lib/unwritten/orders";
import { audienceForMode, defaultMaxLength, visibleSteps, type AnswerError, type Answers } from "@/lib/unwritten/questionnaire/engine";
import { allQuestions, type QuestionnaireDefinition } from "@/lib/unwritten/questionnaire/schema";
import { emailKey, rateLimited } from "@/lib/unwritten/rate-limit";
import { fromUrlToken, toUrlToken } from "@/lib/unwritten/tokens";
import { clientIp, cookieDraftIds, currentRef, forgetDraft, ownsDraft, rememberDraft } from "@/lib/unwritten/session";

/**
 * Actions publiques de la vitrine UNWRITTEN. Règles communes :
 *  - limitation du débit par IP (et par adresse e-mail hachée pour les liens magiques) ;
 *  - un brouillon n'est accessible qu'au navigateur qui le détient (cookie signé) ou par lien magique ;
 *  - journaux sans donnée personnelle (identifiants techniques uniquement).
 */

export type UwFormState = { ok?: boolean; error?: string; errors?: Record<string, string>; message?: string; link?: string };

async function context(localeRaw: FormDataEntryValue | null) {
  const site = await getRequestBrand();
  const locale = String(localeRaw ?? "");
  if (!site || !isLocale(locale) || !openLocales(site).includes(locale)) throw new DraftError("unavailable");
  return { site, locale: locale as Locale, dict: getDictionary(locale as Locale), config: brandConfig(site) };
}

/** Réponses du formulaire : champs « a:<questionId> » (plusieurs valeurs pour un choix multiple). */
function answersFrom(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set([...formData.keys()])) {
    if (!key.startsWith("a:")) continue;
    const values = formData.getAll(key).map(String);
    out[key.slice(2)] = values.length > 1 ? values : values[0];
  }
  return out;
}

function parseUtm(raw: FormDataEntryValue | null): Record<string, string> {
  try {
    const obj = JSON.parse(String(raw ?? "{}")) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(obj).filter(([k, v]) => /^utm_[a-z_]{1,20}$/.test(k) && typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 120)]));
  } catch {
    return {};
  }
}

/** Brouillon modifiable de ce navigateur pour ce produit (le plus récent). */
async function cookieDraftFor(productId: string): Promise<DraftWithRefs | null> {
  const ids = await cookieDraftIds();
  for (const id of [...ids].reverse()) {
    const d = await getDraft(id);
    if (d && d.productId === productId && (d.status === "ACTIVE" || d.status === "CHECKOUT")) return d;
  }
  return null;
}

function draftErrorMessage(e: unknown, dict: ReturnType<typeof getDictionary>): string {
  if (e instanceof DraftError) {
    if (e.code === "expired") return dict.questionnaire.expired;
    if (e.code === "locked") return dict.questionnaire.locked;
    if (e.code === "unavailable" || e.code === "ordered") return dict.questionnaire.unavailable;
    if (e.code === "incomplete") return dict.review.missing;
    if (e.code === "consent") return dict.questionnaire.consentRequired;
  }
  console.error("[unwritten] action", e instanceof Error ? e.message : "erreur");
  return dict.questionnaire.error;
}

/** Messages d'erreur localisés par question (longueur maximale précisée). */
function formatErrors(def: QuestionnaireDefinition, errors: Record<string, AnswerError>, dict: ReturnType<typeof getDictionary>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [q, code] of Object.entries(errors)) {
    const question = allQuestions(def).find((x) => x.id === q);
    out[q] = code === "tooLong" && question ? fill(dict.questionnaire.tooLong, { max: defaultMaxLength(question) }) : dict.questionnaire[code];
  }
  return out;
}

function nextStepId(draft: DraftWithRefs, answers: Answers, current: string): string {
  const steps = visibleSteps(draftDefinition(draft), answers, audienceForMode(draft.mode)).map((s) => s.step.id);
  if (current === "mode") return steps[0] ?? "review";
  const i = steps.indexOf(current);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : "review";
}

/** Enregistre une étape du questionnaire (création du brouillon à la première étape). */
export async function saveStepAction(_prev: UwFormState | undefined, formData: FormData): Promise<UwFormState> {
  let ctx;
  try {
    ctx = await context(formData.get("locale"));
  } catch {
    return { error: "Unavailable" };
  }
  const { site, locale, dict, config } = ctx;
  const ip = await clientIp();
  if (rateLimited("questionnaireIp", ip)) return { error: dict.questionnaire.rateLimited };
  const slug = String(formData.get("product") ?? "");
  const stepId = String(formData.get("step") ?? "");
  let target: string;
  try {
    const product = await prisma.product.findFirst({ where: { siteId: site.id, slug, status: "PUBLISHED" }, select: { id: true } });
    if (!product) throw new DraftError("unavailable");
    let draft = await cookieDraftFor(product.id);
    if (!draft) {
      if (rateLimited("draftCreateIp", ip)) return { error: dict.questionnaire.rateLimited };
      const ref = await currentRef();
      const utm = { ...parseUtm(formData.get("utm")), ...(ref ? { ref } : {}) };
      draft = await startDraft({ siteId: site.id, productId: product.id, locale, currency: brandCurrency(site), utm, retentionDays: config.draftRetentionDays });
      await rememberDraft(draft.id, config.draftRetentionDays);
    }
    if (stepId === "mode") {
      try {
        const updated = await setDraftMode(draft, { mode: String(formData.get("mode") ?? "self"), recipientName: String(formData.get("recipientName") ?? ""), recipientEmail: String(formData.get("recipientEmail") ?? ""), message: String(formData.get("giftMessage") ?? "") }, { retentionDays: config.draftRetentionDays });
        draft.mode = updated.mode;
        // Édition choisie depuis la fiche (?edition=…) : pré-remplie si le brouillon est encore vide
        const pq = String(formData.get("prefillQ") ?? "");
        const pv = String(formData.get("prefillV") ?? "");
        if (pq && pv && !Object.keys(draftAnswers(draft)).length) {
          const q = allQuestions(draftDefinition(draft)).find((x) => x.id === pq && x.type === "single" && x.options?.some((o) => o.value === pv));
          if (q) {
            await prisma.personalizationDraft.update({ where: { id: draft.id }, data: { answers: { [pq]: pv } } });
            draft.answers = { [pq]: pv };
          }
        }
      } catch (e) {
        if (e instanceof DraftError && e.code === "invalid_mode") return { errors: { recipientEmail: dict.questionnaire.invalidChoice } };
        throw e;
      }
      target = nextStepId(draft, draftAnswers(draft), "mode");
    } else {
      const steps = visibleSteps(draftDefinition(draft), draftAnswers(draft), audienceForMode(draft.mode));
      const result = await saveDraftStep(draft, stepId, answersFrom(formData), { consent: formData.get("consent") === "on", consentText: dict.questionnaire.consentLabel, retentionDays: config.draftRetentionDays, stepIndex: steps.findIndex((s) => s.step.id === stepId) + 1 });
      if (!result.ok) return { errors: formatErrors(draftDefinition(draft), result.errors, dict) };
      target = nextStepId(draft, result.answers, stepId);
    }
  } catch (e) {
    return { error: draftErrorMessage(e, dict) };
  }
  redirect(target === "review" ? href(locale, "create", slug, "review") : `${href(locale, "create", slug)}?step=${encodeURIComponent(target)}`);
}

const emailSchema = z.email().max(160);

/** « Terminer plus tard » : lien magique de reprise envoyé par e-mail (réponse neutre). */
export async function requestResumeLinkAction(_prev: UwFormState | undefined, formData: FormData): Promise<UwFormState> {
  let ctx;
  try {
    ctx = await context(formData.get("locale"));
  } catch {
    return { error: "Unavailable" };
  }
  const { site, dict, config } = ctx;
  const neutral = { ok: true, message: dict.questionnaire.saveLater.sent.replace("{hours}", String(config.resumeLinkValidityHours)) };
  const email = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { errors: { email: dict.questionnaire.invalidChoice } };
  if (String(formData.get("website") ?? "")) return neutral; // pot de miel anti-robots
  const ip = await clientIp();
  if (rateLimited("magicLinkEmail", emailKey(email.data)) || rateLimited("magicLinkIp", ip)) return { error: dict.questionnaire.rateLimited };
  const draftId = String(formData.get("draft") ?? "");
  if (!(await ownsDraft(draftId))) return neutral;
  try {
    const draft = await getDraft(draftId);
    if (!draft || draft.siteId !== site.id) return neutral;
    const url = await issueResumeLink(draft, email.data, { validityHours: config.resumeLinkValidityHours, baseUrl: brandUrl(site, "").replace(/\?.*$/, "") });
    await sendResumeLinkEmail({ to: email.data, siteId: site.id, locale: draft.locale, productName: draft.product.name, url: brandUrl(site, url.replace(/^https?:\/\/[^/]+/, "")), validityHours: config.resumeLinkValidityHours });
  } catch (e) {
    console.error("[unwritten] lien de reprise non envoyé", e instanceof Error ? e.message : "erreur");
  }
  return neutral;
}

/** Reprise par lien magique (bouton : un antivirus de messagerie qui ouvre le lien ne le consomme pas). */
export async function consumeResumeAction(formData: FormData) {
  const { site, locale, config } = await context(formData.get("locale"));
  const token = String(formData.get("token") ?? "");
  const ip = await clientIp();
  const back = href(locale, "resume", toUrlToken(token));
  if (rateLimited("tokenIp", ip)) redirect(`${back}?e=invalid`);
  const res = await consumeResumeToken(token);
  if (!res.ok) redirect(`${back}?e=${res.reason === "used" ? "used" : "invalid"}`);
  if (res.draft.siteId !== site.id) redirect(`${back}?e=invalid`);
  await rememberDraft(res.draft.id, config.draftRetentionDays);
  const product = await prisma.product.findUnique({ where: { id: res.draft.productId }, select: { slug: true } });
  redirect(href(locale, "create", product?.slug ?? ""));
}

/** Suppression des réponses par le client (définitive). */
export async function deleteDraftAction(formData: FormData) {
  const { locale } = await context(formData.get("locale"));
  const draftId = String(formData.get("draft") ?? "");
  const slug = String(formData.get("product") ?? "");
  if (await ownsDraft(draftId)) {
    try {
      await deleteDraft(draftId);
    } catch {
      redirect(`${href(locale, "create", slug)}?e=locked`);
    }
    await forgetDraft(draftId);
  }
  redirect(`${href(locale, "books", slug)}?deleted=1`);
}

/** Fige le brouillon et ouvre le paiement Stripe (ligne « produit personnalisé »). */
export async function checkoutAction(_prev: UwFormState | undefined, formData: FormData): Promise<UwFormState> {
  let ctx;
  try {
    ctx = await context(formData.get("locale"));
  } catch {
    return { error: "Unavailable" };
  }
  const { site, locale, dict, config } = ctx;
  const ip = await clientIp();
  if (rateLimited("checkoutIp", ip)) return { error: dict.questionnaire.rateLimited };
  const email = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { errors: { email: dict.questionnaire.required } };
  const draftId = String(formData.get("draft") ?? "");
  if (!(await ownsDraft(draftId))) return { error: dict.questionnaire.unavailable };
  if (!(await isStripeConfigured())) return { error: dict.review.notReady };
  const draft = await getDraft(draftId);
  if (!draft || draft.siteId !== site.id) return { error: dict.questionnaire.unavailable };
  let url: string;
  try {
    await freezeDraftForCheckout(draft, email.data);
    const reviewPath = href(locale, "create", draft.product.slug, "review");
    const session = await createCheckoutSession({
      site,
      lines: [{ kind: "personalized", id: draft.productId, draftId: draft.id, quantity: 1 }],
      email: email.data,
      currency: draft.currency,
      stripeLocale: locale,
      successUrl: brandUrl(site, `${href(locale, "order", "confirmation")}?session_id={CHECKOUT_SESSION_ID}`),
      cancelUrl: brandUrl(site, reviewPath),
      orderPrefix: config.orderPrefix,
      utm: (draft.utm as Record<string, string> | null) ?? null,
      orderMetadata: { locale, storefront: "unwritten" },
    });
    await prisma.personalizationDraft.update({ where: { id: draft.id }, data: { orderId: session.orderId } });
    url = session.url;
  } catch (e) {
    await releaseDraft(draft.id).catch(() => undefined);
    if (e instanceof CheckoutError) return { error: e.message };
    return { error: draftErrorMessage(e, dict) };
  }
  redirect(url);
}

// ---------------------------------------------------------------------------
// Cadeau : le destinataire complète ses informations
// ---------------------------------------------------------------------------

export async function giftSaveStepAction(_prev: UwFormState | undefined, formData: FormData): Promise<UwFormState> {
  let ctx;
  try {
    ctx = await context(formData.get("locale"));
  } catch {
    return { error: "Unavailable" };
  }
  const { locale, dict } = ctx;
  const ip = await clientIp();
  if (rateLimited("questionnaireIp", ip)) return { error: dict.questionnaire.rateLimited };
  const token = String(formData.get("token") ?? "");
  const stepId = String(formData.get("step") ?? "");
  const found = await findGiftByToken(token);
  if (!found.ok) return { error: found.reason === "completed" ? dict.gift.already : dict.gift.invalid };
  let target = "review";
  try {
    const result = await saveGiftStep(found.claim, stepId, answersFrom(formData), { consent: formData.get("consent") === "on" });
    const def = itemDefinition(found.claim.personalItem);
    if (!result.ok) return { errors: def ? formatErrors(def, result.errors, dict) : { _: dict.questionnaire.error } };
    const steps = def ? visibleSteps(def, { ...combinedGiftAnswers(found.claim), ...result.answers }, "subject").map((s) => s.step.id) : [];
    const i = steps.indexOf(stepId);
    target = i >= 0 && i < steps.length - 1 ? steps[i + 1] : "review";
  } catch (e) {
    return { error: e instanceof PersonalItemError ? dict.gift.invalid : dict.questionnaire.error };
  }
  redirect(`${href(locale, "gift", token)}?step=${encodeURIComponent(target)}`);
}

export async function giftCompleteAction(_prev: UwFormState | undefined, formData: FormData): Promise<UwFormState> {
  let ctx;
  try {
    ctx = await context(formData.get("locale"));
  } catch {
    return { error: "Unavailable" };
  }
  const { locale, dict } = ctx;
  const token = String(formData.get("token") ?? "");
  const found = await findGiftByToken(token);
  if (!found.ok) return { error: found.reason === "completed" ? dict.gift.already : dict.gift.invalid };
  try {
    await completeGift(found.claim.id);
  } catch (e) {
    return { error: e instanceof PersonalItemError && e.status === 422 ? dict.review.missing : dict.questionnaire.error };
  }
  redirect(`${href(locale, "gift", token)}?done=1`);
}

/** Page de suivi : nouveau lien pour le destinataire (l'ancien est désactivé). */
export async function rotateGiftLinkAction(_prev: UwFormState | undefined, formData: FormData): Promise<UwFormState> {
  let ctx;
  try {
    ctx = await context(formData.get("locale"));
  } catch {
    return { error: "Unavailable" };
  }
  const { site, locale, dict } = ctx;
  const ip = await clientIp();
  if (rateLimited("tokenIp", ip)) return { error: dict.questionnaire.rateLimited };
  const orderId = verifyOrderAccessToken(fromUrlToken(String(formData.get("orderToken") ?? "")));
  const itemId = String(formData.get("item") ?? "");
  if (!orderId) return { error: dict.order.invalid };
  const item = await prisma.personalOrderItem.findFirst({ where: { id: itemId, orderId, siteId: site.id }, select: { id: true } });
  if (!item) return { error: dict.order.invalid };
  try {
    const { token } = await rotateGiftToken(item.id);
    return { ok: true, link: brandHref(site, locale, "gift", token) };
  } catch {
    return { error: dict.gift.already };
  }
}
