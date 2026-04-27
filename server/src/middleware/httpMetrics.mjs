import { recordHttpRequest, normalizeRouteKey } from "../observability/metrics.mjs";

/**
 * Counts and latency per normalized route (after res finishes).
 */
export function httpMetrics(req, res, next) {
  const start = globalThis.performance?.now() ?? Date.now();
  res.on("finish", () => {
    const end = globalThis.performance?.now() ?? Date.now();
    const rawPath = (req.baseUrl || "") + (req.path || "");
    const pathOnly = rawPath.split("?")[0] || rawPath;
    const key = normalizeRouteKey(req.method || "GET", pathOnly);
    const durationMs = Math.max(0, Math.round(end - start));
    recordHttpRequest(key, res.statusCode ?? 0, durationMs);
  });
  next();
}
