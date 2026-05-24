/**
 * In-process counters for ops dashboards. Reset on process restart; use external collector for long-term.
 */

const http = new Map();
const httpStatus = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, other: 0 };
const auth = { loginOk: 0, loginFail: 0, loginError: 0, loginDbDown: 0 };
const webhooks = { stripeOk: 0, stripeDedup: 0, stripeInvalidSig: 0, stripeHandlerFail: 0, stripeMisconfig: 0, razorpay: 0 };
const billing = { checkoutSessionsCreated: 0, checkoutSessionError: 0, changePlan: 0, changePlanError: 0 };

function bucketStatus(code) {
  if (code >= 200 && code < 300) return "2xx";
  if (code >= 300 && code < 400) return "3xx";
  if (code >= 400 && code < 500) return "4xx";
  if (code >= 500) return "5xx";
  return "other";
}

/**
 * @param {string} routeKey  Normalized e.g. GET /api/auth/login
 * @param {number} statusCode
 * @param {number} durationMs
 */
export function recordHttpRequest(routeKey, statusCode, durationMs) {
  const statusBucket = bucketStatus(statusCode);
  httpStatus[statusBucket] = (httpStatus[statusBucket] ?? 0) + 1;
  const prev = http.get(routeKey) ?? { count: 0, totalMs: 0, err5xx: 0 };
  prev.count += 1;
  prev.totalMs += durationMs;
  if (statusCode >= 500) prev.err5xx += 1;
  http.set(routeKey, prev);
}

export const metricsAuth = {
  loginOk() {
    auth.loginOk += 1;
  },
  loginFail() {
    auth.loginFail += 1;
  },
  loginError() {
    auth.loginError += 1;
  },
  loginDbDown() {
    auth.loginDbDown += 1;
  },
};

export const metricsWebhook = {
  stripeOk() {
    webhooks.stripeOk += 1;
  },
  stripeDedup() {
    webhooks.stripeDedup += 1;
  },
  stripeInvalidSig() {
    webhooks.stripeInvalidSig += 1;
  },
  stripeHandlerFail() {
    webhooks.stripeHandlerFail += 1;
  },
  stripeMisconfig() {
    webhooks.stripeMisconfig += 1;
  },
  razorpay() {
    webhooks.razorpay += 1;
  },
};

export const metricsBilling = {
  checkoutSessionCreated() {
    billing.checkoutSessionsCreated += 1;
  },
  checkoutSessionError() {
    billing.checkoutSessionError += 1;
  },
  changePlan() {
    billing.changePlan += 1;
  },
  changePlanError() {
    billing.changePlanError += 1;
  },
};

export function getMetricsSnapshot() {
  const byRoute = Object.fromEntries(
    [...http.entries()].map(([k, v]) => [k, { count: v.count, avgDurationMs: v.count ? Math.round(v.totalMs / v.count) : 0, err5xx: v.err5xx }]),
  );
  return {
    process: {
      uptimeSec: Math.round(process.uptime()),
      rssBytes: process.memoryUsage().rss,
      heapUsed: process.memoryUsage().heapUsed,
    },
    httpStatus,
    byRoute: byRoute,
    auth,
    webhooks,
    billing,
  };
}

/**
 * @param {string} path
 * @returns {string}
 */
export function normalizeRouteKey(method, path) {
  if (!path) return `${method} /`;
  const p = String(path);
  return `${method} ${p
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      if (seg.length >= 20 && /^c[a-z0-9]+$/i.test(seg)) return ":id";
      if (seg.length >= 24 && /^[0-9a-f-]{24,36}$/i.test(seg)) return ":id";
      if (/^cm[a-z0-9_]+$/i.test(seg) && seg.length > 8) return ":id";
      return seg;
    })
    .join("/")}`.replace(/\/+/g, "/");
}
