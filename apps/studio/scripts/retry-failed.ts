import "dotenv/config";
import { prisma } from "@/lib/db";
import { retryJob } from "@/lib/queue/jobs";
(async () => {
  const failed = await prisma.job.findMany({ where: { status: "FAILED", type: "activity.generate" } });
  for (const j of failed) console.log("relance", j.id, "->", (await retryJob(j.id)).id);
  await prisma.$disconnect();
  process.exit(0);
})();
