import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env") });

const prisma = new PrismaClient();
const plans = await prisma.plan.findMany({
  select: { code: true, name: true, stripePriceMonthlyId: true, stripePriceYearlyId: true },
  orderBy: { code: "asc" },
});
console.log("Plans and Stripe price IDs (empty = checkout will fail for that plan):\n");
for (const p of plans) {
  console.log(
    `  ${p.code} (${p.name})  monthly: ${p.stripePriceMonthlyId || "—"}  yearly: ${p.stripePriceYearlyId || "—"}`,
  );
}
await prisma.$disconnect();
