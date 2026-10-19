import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bookId = url.searchParams.get("bookId") ?? undefined;
  const activityId = url.searchParams.get("activityId") ?? undefined;
  const jobs = await prisma.job.findMany({ where: { bookId, activityId, parentId: null }, orderBy: { createdAt: "desc" }, take: 30 });
  return NextResponse.json(jobs.map((j) => ({ ...j, costUsd: Number(j.costUsd) })));
}
