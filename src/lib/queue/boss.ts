import { PgBoss } from "pg-boss";

let boss: PgBoss | null = null;
let starting: Promise<PgBoss> | null = null;

export const QUEUES = {
  bookPipeline: "book.pipeline",
  bookOutline: "book.outline",
  activityGenerate: "activity.generate",
  activityIllustrate: "activity.illustrate",
  illustrationSingle: "illustration.single",
  bookLayout: "book.layout",
  bookExport: "book.export",
  bookCover: "book.cover",
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  if (!starting) {
    starting = (async () => {
      const b = new PgBoss({ connectionString: process.env.DATABASE_URL ?? "", schema: "pgboss" });
      b.on("error", (e: unknown) => console.error("[pg-boss]", e));
      await b.start();
      for (const q of Object.values(QUEUES)) await b.createQueue(q, { retryLimit: 2, retryDelay: 15, retryBackoff: true, expireInSeconds: 3600 * 2, deleteAfterSeconds: 7 * 24 * 3600 }).catch(() => undefined);
      boss = b;
      return b;
    })();
  }
  return starting;
}

export async function stopBoss() {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 10_000 });
    boss = null;
    starting = null;
  }
}
