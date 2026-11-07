import { PrismaClient } from "@prisma/client";
import { resolveDbSchema, withDbSchema } from "@/lib/db-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: withDbSchema(process.env.DATABASE_URL, resolveDbSchema()),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Db = PrismaClient;
