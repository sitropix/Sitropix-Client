import { randomUUID } from "node:crypto";

const MAX_INBOUND_ID_LEN = 128;

/**
 * Propagate or assign `X-Request-Id` and attach `req.requestId` (also used by logs and audit).
 */
export function requestContext(req, res, next) {
  const fromHeader = String(req.get("X-Request-Id") || req.get("X-Correlation-Id") || "")
    .trim()
    .slice(0, MAX_INBOUND_ID_LEN);
  const id = fromHeader && /^[\x20-\x7e]+$/.test(fromHeader) ? fromHeader : randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}
