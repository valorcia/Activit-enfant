"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  productId: z.string().min(1),
  authorName: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(120),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(20).max(2000),
  consent: z.literal("on"),
  website: z.string().max(0).optional(), // honeypot : doit rester vide
});

export type ReviewActionState = { ok: true; message: string } | { ok: false; error: string } | undefined;

/** Dépose un avis en attente de modération. Jamais publié automatiquement. */
export async function submitReviewAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = String(first?.path?.[0] ?? "");
    const msg: Record<string, string> = {
      authorName: "Indiquez votre prénom (2 caractères minimum).",
      email: "Adresse email invalide.",
      rating: "Choisissez une note de 1 à 5.",
      body: "Votre avis doit contenir entre 20 et 2000 caractères.",
      consent: "Vous devez accepter la publication de votre avis.",
    };
    return { ok: false, error: msg[field] ?? "Formulaire invalide." };
  }
  const d = parsed.data;
  if (d.website) return { ok: true, message: "Merci, votre avis sera publié après modération." }; // bot : réponse neutre

  const product = await prisma.product.findFirst({ where: { id: d.productId, status: "PUBLISHED" }, select: { id: true } });
  if (!product) return { ok: false, error: "Produit introuvable." };

  const email = d.email.toLowerCase();
  const existing = await prisma.review.findFirst({ where: { productId: product.id, email } });
  if (existing) return { ok: false, error: "Vous avez déjà déposé un avis pour ce produit." };

  const customer = await prisma.customer.findUnique({ where: { email }, select: { id: true } });
  const paidOrder = await prisma.order.findFirst({
    where: {
      email, status: { in: ["PAID", "PARTIALLY_REFUNDED"] },
      OR: [{ items: { some: { productId: product.id } } }, { entitlements: { some: { productId: product.id } } }],
    },
    select: { id: true },
  });

  await prisma.review.create({
    data: {
      productId: product.id, customerId: customer?.id, orderId: paidOrder?.id,
      authorName: d.authorName, email, rating: d.rating, title: d.title || null, body: d.body,
      status: "PENDING", isVerifiedPurchase: !!paidOrder,
    },
  });
  return { ok: true, message: "Merci, votre avis sera publié après modération." };
}
