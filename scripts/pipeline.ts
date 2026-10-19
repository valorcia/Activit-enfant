import "dotenv/config";
import { startBookPipeline } from "../src/worker/handlers";
import { prisma } from "@/lib/db";
const [bookId] = process.argv.slice(2);
startBookPipeline(bookId, { withIllustrations: true, withCover: true }).then(async (j) => { console.log(j.id); await prisma.$disconnect(); process.exit(0); });
