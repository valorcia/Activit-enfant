import { PrismaClient } from "@prisma/client";
import { resolveDbSchema, withDbSchema } from "@/lib/db-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: withDbSchema(process.env.DATABASE_URL, resolveDbSchema()),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Base distante (Neon) : marge au-delà des 5 s par défaut d'une transaction interactive (erreur P2028)
    transactionOptions: { maxWait: 15_000, timeout: 60_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Db = PrismaClient;
