import { env } from "./env.mjs";
import { prisma } from "../db/client.mjs";
import { log } from "../observability/logger.mjs";

function databaseHostLabel() {
  try {
    return new URL(env.databaseUrl).hostname;
  } catch {
    return "unknown";
  }
}

/**
 * Prisma Postgres / remote DB can be slow to accept connections on cold start.
 * Retry before failing API startup.
 */
export async function connectDb({ attempts = 5, delayMs = 2500 } = {}) {
  const host = databaseHostLabel();
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$connect();
      if (attempt > 1) {
        log.info("db.connect.recovered", { host, attempt });
      }
      return;
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      log.warn("db.connect.retry", { host, attempt, attempts, error: message });
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  log.error("db.connect.failed", {
    host,
    attempts,
    hint:
      host.includes("prisma.io")
        ? "Check Prisma Postgres is running in the Prisma console, or set USE_LOCAL_DATABASE=true with DATABASE_URL_LOCAL for local Postgres."
        : "Verify DATABASE_URL and that PostgreSQL is reachable.",
  });
  throw lastError;
}

export { prisma };
