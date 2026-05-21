import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.mjs";

const globalForPrisma = globalThis;

function isRemoteManagedDbHost(hostname) {
  return (
    hostname === "db.prisma.io" ||
    hostname.endsWith(".prisma.io") ||
    hostname.includes("pooler.supabase.com")
  );
}

function withPrismaPoolOptions(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const remote = isRemoteManagedDbHost(url.hostname);

    if (!url.searchParams.has("connect_timeout")) {
      url.searchParams.set(
        "connect_timeout",
        String(remote ? 60 : 15),
      );
    }
    if (env.prismaPoolConnectionLimit != null) {
      url.searchParams.set(
        "connection_limit",
        String(env.prismaPoolConnectionLimit),
      );
    } else if (remote && !url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "5");
    }
    if (env.prismaPoolTimeoutSeconds != null) {
      url.searchParams.set("pool_timeout", String(env.prismaPoolTimeoutSeconds));
    } else if (remote && !url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "30");
    }
    if (remote && !url.searchParams.has("sslmode")) {
      url.searchParams.set("sslmode", "require");
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
