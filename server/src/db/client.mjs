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

function createPrismaClient() {
  return new PrismaClient({
    datasources: { db: { url: withPrismaPoolOptions(env.databaseUrl) } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Dev hot-reload can keep an old PrismaClient without newly generated models. */
function prismaClientHasRecurringAddonStore(client) {
  return typeof client?.projectRecurringAddonStripe?.findUnique === "function";
}

function resolvePrismaClient() {
  const cached = globalForPrisma.prisma;
  if (cached && prismaClientHasRecurringAddonStore(cached)) {
    return cached;
  }
  const next = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = next;
  }
  return next;
}

export const prisma = resolvePrismaClient();
