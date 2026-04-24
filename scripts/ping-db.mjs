import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });
const p = new PrismaClient();
await p.$connect();
console.log("DB_OK");
await p.$disconnect();
