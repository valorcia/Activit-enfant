import { PrismaClient } from "@prisma/client";
import { resolveDbSchema, withDbSchema } from "@/lib/db-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: withDbSchema(process.env.DATABASE_URL, resolveDbSchema()),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Un livre peut compter plus de 100 pages : l'enregistrement de l'éditeur ou la remise en page
    // dépasse vite les 5 s par défaut d'une transaction sur une base distante (erreur P2028).
    transactionOptions: { maxWait: 20_000, timeout: 120_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
