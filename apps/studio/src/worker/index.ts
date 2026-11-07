/**
 * Worker de tâches asynchrones (processus séparé du serveur web).
 * Lancer avec : pnpm worker
 * Il consomme les files pg-boss (PostgreSQL), aucune dépendance Redis.
 */
import "dotenv/config";
import { getBoss, stopBoss, QUEUES } from "@/lib/queue/boss";
import type { Job } from "pg-boss";
import { setJob, jobLog, type JobPayload } from "@/lib/queue/jobs";
import { getAiSettings } from "@/lib/settings";
import { handlers } from "./handlers";
import { closeBrowser } from "@/lib/pdf/browser";
import { prisma } from "@/lib/db";

async function main() {
  const boss = await getBoss();
  const settings = await getAiSettings();
  const concurrency = settings.maxConcurrentGenerations;
  console.log(`[worker] démarré — concurrence ${concurrency}, fournisseurs texte=${settings.textProvider} image=${settings.imageProvider}`);

  for (const queue of Object.values(QUEUES)) {
    const teamSize = queue === QUEUES.bookPipeline ? 1 : queue === QUEUES.bookExport ? 1 : concurrency;
    await boss.work<JobPayload>(queue, { batchSize: 1, pollingIntervalSeconds: 2, localConcurrency: teamSize }, async (jobs: Job<JobPayload>[]) => {
      for (const job of jobs) {
        const data = job.data;
        const handler = handlers[queue];
        const current = await prisma.job.findUnique({ where: { id: data.jobId } });
        if (!current || current.status === "CANCELLED") continue;
        await prisma.job.update({ where: { id: data.jobId }, data: { attempts: { increment: 1 }, queueJobId: job.id } });
        console.log(`[worker] ${queue} #${data.jobId}`);
        try {
          await handler(data);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[worker] échec ${queue} #${data.jobId}: ${message}`);
          await jobLog(data.jobId, message, "error");
          await setJob(data.jobId, { status: "FAILED", error: message });
          throw err; // laisse pg-boss gérer les tentatives
        }
      }
    });
  }

  const shutdown = async () => {
    console.log("[worker] arrêt…");
    await closeBrowser();
    await stopBoss();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
