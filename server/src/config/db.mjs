import { prisma } from "../db/client.mjs";

export async function connectDb() {
  await prisma.$connect();
}

export { prisma };
