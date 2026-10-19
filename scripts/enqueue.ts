import "dotenv/config";
import { enqueue, QUEUES } from "@/lib/queue/jobs";
const [type, activityId, bookId] = process.argv.slice(2);
enqueue(type as never, { activityId: activityId || undefined, bookId: bookId || undefined }).then((j) => { console.log(j.id); process.exit(0); });
