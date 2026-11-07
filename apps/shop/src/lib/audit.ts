import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function audit(entry: { userId?: string | null; actor?: string | null; action: string; entity: string; entityId?: string | null; data?: Prisma.InputJsonValue }) {
  try {
    await prisma.auditLog.create({ data: { userId: entry.userId ?? undefined, actor: entry.actor ?? undefined, action: entry.action, entity: entry.entity, entityId: entry.entityId ?? undefined, data: entry.data } });
  } catch (e) {
    console.warn("[audit] échec", e);
  }
}
