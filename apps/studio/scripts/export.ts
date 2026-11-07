import "dotenv/config";
import { prisma } from "@/lib/db";
import { createExport } from "@/lib/export";
import { enqueue, QUEUES } from "@/lib/queue/jobs";
const [kind, bookId, activityId] = process.argv.slice(2);
(async () => {
  const exp = await createExport({ kind: kind as never, bookId: bookId || undefined, activityId: activityId || undefined });
  const job = await enqueue(QUEUES.bookExport, { bookId: bookId || undefined, activityId: activityId || undefined, exportId: exp.id });
  console.log(job.id, exp.id);
  await prisma.$disconnect();
  process.exit(0);
})();
