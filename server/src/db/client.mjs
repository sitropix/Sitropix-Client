import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.mjs";

const globalForPrisma = globalThis;

function withPrismaPoolOptions(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    if (env.prismaPoolConnectionLimit != null) {
      url.searchParams.set(
        "connection_limit",
        String(env.prismaPoolConnectionLimit),
      );
    }
    if (env.prismaPoolTimeoutSeconds != null) {
      url.searchParams.set("pool_timeout", String(env.prismaPoolTimeoutSeconds));
    }
    return url.toString();
  } catch {
    // Keep startup resilient for non-standard URL formats.
    return databaseUrl;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: withPrismaPoolOptions(env.databaseUrl) } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
