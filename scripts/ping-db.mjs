import dotenv from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });
const { connectDb, prisma } = await import("../server/src/config/db.mjs");
await connectDb({ attempts: 3, delayMs: 2000 });
console.log("DB_OK");
await prisma.$disconnect();
