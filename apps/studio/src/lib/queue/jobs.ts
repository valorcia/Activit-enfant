import { prisma } from "../db";
import { getBoss, QUEUES, type QueueName } from "./boss";
import type { JobStatus, Prisma } from "@prisma/client";

export type JobPayload = {
  jobId: string;
  bookId?: string;
  activityId?: string;
} & Record<string, unknown>;

/** Crée l'enregistrement Job (visible dans l'UI) et l'envoie dans la file pg-boss. */
export async function enqueue(type: QueueName, data: Omit<JobPayload, "jobId">, opts?: { parentId?: string; priority?: number }) {
  const job = await prisma.job.create({ data: { type, status: "QUEUED", bookId: data.bookId as string | undefined, activityId: data.activityId as string | undefined, parentId: opts?.parentId, payload: data as Prisma.InputJsonValue } });
  const boss = await getBoss();
  const queueJobId = await boss.send(type, { ...data, jobId: job.id }, { priority: opts?.priority ?? 0, retryLimit: 2, retryDelay: 15, expireInSeconds: 3600 * 2 });
  await prisma.job.update({ where: { id: job.id }, data: { queueJobId: queueJobId ?? undefined } });
  return job;
}

export async function setJob(jobId: string, data: { status?: JobStatus; progress?: number; step?: string; error?: string | null; result?: Prisma.InputJsonValue; costUsd?: number }) {
  const current = await prisma.job.findUnique({ where: { id: jobId } });
  if (!current) return;
  const patch: Prisma.JobUpdateInput = {};
  if (data.status) {
    patch.status = data.status;
    if (data.status === "RUNNING" && !current.startedAt) patch.startedAt = new Date();
    if (["COMPLETED", "FAILED", "CANCELLED"].includes(data.status)) patch.finishedAt = new Date();
  }
  if (data.progress !== undefined) patch.progress = Math.max(0, Math.min(100, Math.round(data.progress)));
  if (data.step !== undefined) patch.step = data.step;
  if (data.error !== undefined) patch.error = data.error;
  if (data.result !== undefined) patch.result = data.result;
  if (data.costUsd !== undefined) patch.costUsd = { increment: data.costUsd };
  await prisma.job.update({ where: { id: jobId }, data: patch });
}

export async function jobLog(jobId: string, message: string, level: "info" | "warn" | "error" = "info", data?: Prisma.InputJsonValue) {
  await prisma.jobLog.create({ data: { jobId, level, message, data } }).catch(() => undefined);
}

/** Le pipeline vérifie ce drapeau entre chaque étape pour respecter pause / annulation. */
export async function controlSignal(jobId: string): Promise<"continue" | "paused" | "cancelled"> {
  const j = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!j) return "cancelled";
  if (j.status === "CANCELLED") return "cancelled";
  if (j.status === "PAUSED") return "paused";
  return "continue";
}

/** Attend la reprise d'un job en pause (ou l'annulation). */
export async function waitWhilePaused(jobId: string): Promise<"continue" | "cancelled"> {
  for (;;) {
    const s = await controlSignal(jobId);
    if (s !== "paused") return s;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export async function pauseJob(jobId: string) {
  await prisma.job.updateMany({ where: { id: jobId, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: "PAUSED" } });
}
export async function resumeJob(jobId: string) {
  await prisma.job.updateMany({ where: { id: jobId, status: "PAUSED" }, data: { status: "RUNNING" } });
}
export async function cancelJob(jobId: string) {
  await prisma.job.updateMany({ where: { id: jobId, status: { in: ["QUEUED", "RUNNING", "PAUSED"] } }, data: { status: "CANCELLED", finishedAt: new Date() } });
  await prisma.job.updateMany({ where: { parentId: jobId, status: { in: ["QUEUED", "RUNNING", "PAUSED"] } }, data: { status: "CANCELLED", finishedAt: new Date() } });
}

/** Relance un job échoué : nouveau job avec la même charge utile. */
export async function retryJob(jobId: string) {
  const j = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  const payload = (j.payload ?? {}) as Record<string, unknown>;
  return enqueue(j.type as QueueName, { ...payload, bookId: j.bookId ?? undefined, activityId: j.activityId ?? undefined }, { parentId: j.parentId ?? undefined });
}

export { QUEUES };
