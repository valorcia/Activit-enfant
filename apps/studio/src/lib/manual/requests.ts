import { prisma } from "../db";
import { getBoss, type QueueName } from "../queue/boss";
import { setJob, jobLog } from "../queue/jobs";

/**
 * Suivi des demandes « à coller » et reprise automatique des tâches en attente.
 */

export async function pendingCount(): Promise<number> {
  return prisma.manualRequest.count({ where: { status: "PENDING" } });
}

export async function pendingCountForJob(jobId: string): Promise<number> {
  const ids = await jobTreeIds(jobId);
  return prisma.manualRequest.count({ where: { status: "PENDING", jobId: { in: ids } } });
}

/** Identifiants d'une tâche et de toutes ses sous-tâches. */
export async function jobTreeIds(jobId: string): Promise<string[]> {
  const ids = [jobId];
  let frontier = [jobId];
  while (frontier.length) {
    const children = await prisma.job.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  return ids;
}

/** Tâche racine (celle qui est réellement dans la file pg-boss). */
export async function rootJobId(jobId: string): Promise<string> {
  let current = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, parentId: true } });
  while (current?.parentId) {
    current = await prisma.job.findUnique({ where: { id: current.parentId }, select: { id: true, parentId: true } });
  }
  return current?.id ?? jobId;
}

/** Met une tâche (et sa racine) en attente de réponses à coller. */
export async function markWaitingInput(jobId: string, count: number) {
  const step = `En attente de ${count} réponse${count > 1 ? "s" : ""} à coller`;
  await setJob(jobId, { status: "WAITING_INPUT", step, error: null });
  await jobLog(jobId, `${step} (page « À coller »)`);
  const root = await rootJobId(jobId);
  if (root !== jobId) await setJob(root, { status: "WAITING_INPUT", step, error: null });
}

/**
 * Après la résolution d'une demande : si plus rien n'est en attente pour la tâche
 * racine, on la remet dans la file avec la même charge utile (même identifiant).
 */
export async function resumeJobIfReady(jobId: string | null | undefined): Promise<"requeued" | "waiting" | "none"> {
  if (!jobId) return "none";
  const root = await rootJobId(jobId);
  const remaining = await pendingCountForJob(root);
  if (remaining > 0) {
    await setJob(root, { step: `En attente de ${remaining} réponse${remaining > 1 ? "s" : ""} à coller` });
    return "waiting";
  }
  const job = await prisma.job.findUnique({ where: { id: root } });
  if (!job || job.status !== "WAITING_INPUT") return "none";
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const boss = await getBoss();
  const queueJobId = await boss.send(job.type as QueueName, { ...payload, bookId: job.bookId ?? undefined, activityId: job.activityId ?? undefined, jobId: job.id }, { retryLimit: 2, retryDelay: 15, expireInSeconds: 3600 * 2 });
  await prisma.job.update({ where: { id: job.id }, data: { status: "QUEUED", step: "Reprise après collage des réponses", queueJobId: queueJobId ?? undefined } });
  await prisma.job.updateMany({ where: { parentId: job.id, status: "WAITING_INPUT" }, data: { status: "QUEUED" } });
  await jobLog(job.id, "Réponses collées : reprise de la tâche");
  return "requeued";
}
