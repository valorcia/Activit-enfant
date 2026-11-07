import type { Prisma } from "@prisma/client";

/** Génère un numéro lisible : PREFIX-AAAA-000123 (compteur annuel). */
export async function nextOrderNumber(tx: Prisma.TransactionClient, prefix: string, now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const count = await tx.order.count({ where: { createdAt: { gte: start, lt: end } } });
  return `${prefix}-${year}-${String(count + 1).padStart(6, "0")}`;
}

export async function nextInvoiceNumber(tx: Prisma.TransactionClient, prefix: string, now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const count = await tx.order.count({ where: { invoiceNumber: { startsWith: `${prefix}-${year}-` } } });
  return `${prefix}-${year}-${String(count + 1).padStart(6, "0")}`;
}
