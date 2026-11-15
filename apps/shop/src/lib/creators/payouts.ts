import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { decryptIban, formatIban } from "./iban";
import { getCreatorSettings } from "./settings";

/**
 * Paiements mensuels par virement manuel (phase 1).
 * « Préparer les paiements » regroupe, par créatrice, les commissions confirmées non encore
 * rattachées à un paiement ; un paiement n'est créé que si le total atteint le seuil
 * (sinon les commissions sont reportées au mois suivant). Idempotent sur la période :
 * un paiement en préparation existant est complété plutôt que dupliqué.
 */

export function periodOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export interface PreparedPayouts {
  period: string;
  created: number;
  updated: number;
  belowThreshold: Array<{ creatorId: string; totalCents: number }>;
}

export async function preparePayouts(db: PrismaClient = defaultPrisma, now = new Date(), thresholdCents?: number): Promise<PreparedPayouts> {
  const threshold = thresholdCents ?? (await getCreatorSettings(db)).payoutThresholdCents;
  const period = periodOf(now);
  const groups = await db.commissionEntry.groupBy({ by: ["creatorId"], where: { status: "CONFIRMED", payoutId: null }, _sum: { amountCents: true } });
  const out: PreparedPayouts = { period, created: 0, updated: 0, belowThreshold: [] };

  for (const g of groups) {
    const total = g._sum.amountCents ?? 0;
    if (total < threshold || total <= 0) {
      out.belowThreshold.push({ creatorId: g.creatorId, totalCents: total });
      continue;
    }
    await db.$transaction(async (tx) => {
      const existing = await tx.creatorPayout.findFirst({ where: { creatorId: g.creatorId, period, status: "PENDING" } });
      const payout = existing ?? (await tx.creatorPayout.create({ data: { creatorId: g.creatorId, period, totalCents: 0 } }));
      await tx.commissionEntry.updateMany({ where: { creatorId: g.creatorId, status: "CONFIRMED", payoutId: null }, data: { payoutId: payout.id } });
      const agg = await tx.commissionEntry.aggregate({ where: { payoutId: payout.id, status: { not: "CANCELLED" } }, _sum: { amountCents: true } });
      await tx.creatorPayout.update({ where: { id: payout.id }, data: { totalCents: agg._sum.amountCents ?? 0 } });
      if (existing) out.updated++;
      else out.created++;
    });
  }
  return out;
}

/** « Marquer payé » : référence du virement, commissions du paiement passées à « payée ». */
export async function markPayoutPaid(payoutId: string, reference: string, opts: { userId?: string | null } = {}, db: PrismaClient = defaultPrisma, now = new Date()) {
  const ref = reference.trim();
  if (!ref) throw new Error("Référence du virement requise");
  return db.$transaction(async (tx) => {
    const payout = await tx.creatorPayout.findUniqueOrThrow({ where: { id: payoutId } });
    if (payout.status === "PAID") return payout;
    await tx.commissionEntry.updateMany({ where: { payoutId, status: "CONFIRMED" }, data: { status: "PAID", paidAt: now } });
    return tx.creatorPayout.update({ where: { id: payoutId }, data: { status: "PAID", reference: ref.slice(0, 120), paidAt: now, paidById: opts.userId ?? null } });
  });
}

/** Retire un paiement en préparation : ses commissions redeviennent disponibles. */
export async function cancelPendingPayout(payoutId: string, db: PrismaClient = defaultPrisma) {
  await db.$transaction(async (tx) => {
    const payout = await tx.creatorPayout.findUniqueOrThrow({ where: { id: payoutId } });
    if (payout.status !== "PENDING") throw new Error("Un paiement déjà versé ne peut pas être annulé");
    await tx.commissionEntry.updateMany({ where: { payoutId }, data: { payoutId: null } });
    await tx.creatorPayout.delete({ where: { id: payoutId } });
  });
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Export CSV (séparateur « ; », Excel français) des paiements d'une période. C'est le seul
 * endroit où l'IBAN est déchiffré ; il n'est ni journalisé ni renvoyé ailleurs.
 */
export async function payoutsCsv(period: string, db: PrismaClient = defaultPrisma): Promise<{ csv: string; count: number }> {
  const payouts = await db.creatorPayout.findMany({
    where: { period },
    orderBy: { createdAt: "asc" },
    include: { creator: { select: { name: true, publicName: true, email: true, ibanEnc: true, ibanHolder: true } }, _count: { select: { entries: true } } },
  });
  const header = ["Période", "Créatrice", "Pseudo", "E-mail", "Titulaire du compte", "IBAN", "Montant (EUR)", "Commissions", "Statut", "Référence du virement", "Payé le"];
  const rows = payouts.map((p) => {
    let iban = "";
    if (p.creator.ibanEnc) {
      try { iban = formatIban(decryptIban(p.creator.ibanEnc)); } catch { iban = "ILLISIBLE (clé de chiffrement modifiée ?)"; }
    }
    return [
      p.period, p.creator.name, p.creator.publicName ?? "", p.creator.email, p.creator.ibanHolder ?? "", iban || "MANQUANT",
      (p.totalCents / 100).toFixed(2).replace(".", ","), p._count.entries, p.status === "PAID" ? "Payé" : "À payer", p.reference ?? "", p.paidAt ? p.paidAt.toISOString().slice(0, 10) : "",
    ];
  });
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
  return { csv, count: payouts.length };
}
