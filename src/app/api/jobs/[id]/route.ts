import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id }, include: { logs: { orderBy: { createdAt: "desc" }, take: 20 } } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  const children = await prisma.job.findMany({ where: { parentId: id }, orderBy: { createdAt: "asc" }, include: { activity: { select: { title: true } } } });
  return NextResponse.json({ ...job, costUsd: Number(job.costUsd), children: children.map((c) => ({ ...c, costUsd: Number(c.costUsd) })) });
}
