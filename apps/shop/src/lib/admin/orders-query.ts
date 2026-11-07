import type { Prisma } from "@prisma/client";

export const ORDER_STATUSES = ["PAID", "PENDING", "FAILED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"] as const;

/** Filtre des commandes partagé entre la liste admin et l'export CSV. */
export function buildOrderWhere(sp: { q?: string; statut?: string; periode?: string }): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (sp.q) where.OR = [{ number: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q, mode: "insensitive" } }, { billingName: { contains: sp.q, mode: "insensitive" } }];
  if (sp.statut && (ORDER_STATUSES as readonly string[]).includes(sp.statut)) where.status = sp.statut as Prisma.OrderWhereInput["status"];
  const days = Number(sp.periode);
  if (days > 0) where.createdAt = { gte: new Date(Date.now() - days * 86400_000) };
  return where;
}
