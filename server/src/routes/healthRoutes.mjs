import express from "express";
import { prisma } from "../db/client.mjs";
import { env } from "../config/env.mjs";
import { getMetricsSnapshot } from "../observability/metrics.mjs";

const router = express.Router();

/** Liveness — process is up (no external dependency check). */
router.get("/health", (_req, res) => {
  return res.json({
    ok: true,
    service: "zohoportal-api",
    environment: env.nodeEnv,
    ts: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
  });
});

/** Readiness — database reachable. */
router.get("/health/ready", async (_req, res) => {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      ok: true,
      service: "zohoportal-api",
      database: "up",
      latencyMs: Date.now() - t0,
    });
  } catch (e) {
    return res.status(503).json({
      ok: false,
      service: "zohoportal-api",
      database: "down",
      error: env.nodeEnv === "development" ? e?.message : "unavailable",
    });
  }
});

/**
 * In-process counters and HTTP aggregates. Protect with METRICS_BEARER_TOKEN; without it,
 * the endpoint is hidden in production and open (with a warning) in other environments.
 */
router.get("/metrics", (req, res) => {
  if (!env.metricsBearerToken) {
    if (env.nodeEnv === "production") {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({
      ...getMetricsSnapshot(),
      _warning: "Set METRICS_BEARER_TOKEN and use Authorization: Bearer in production.",
    });
  }
  const authz = String(req.headers.authorization || "");
  const expected = `Bearer ${env.metricsBearerToken}`;
  if (authz !== expected) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return res.json(getMetricsSnapshot());
});

export { router as healthRouter };
