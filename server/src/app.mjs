import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.mjs";
import { connectDb } from "./config/db.mjs";
import { authRouter } from "./routes/authRoutes.mjs";
import { subscriptionRouter, adminRouter } from "./routes/subscriptionRoutes.mjs";
import { clientDocumentRouter, adminClientDocumentRouter } from "./routes/clientDocumentRoutes.mjs";
import { adminSupportRouter } from "./routes/adminSupportRoutes.mjs";
import { supportRouter } from "./routes/supportRoutes.mjs";
import { projectRouter, adminProjectRouter } from "./routes/projectRoutes.mjs";
import { webhookRouter } from "./routes/webhookRoutes.mjs";
import { healthRouter } from "./routes/healthRoutes.mjs";
import { formPublicRouter } from "./routes/formPublicRoutes.mjs";
import { adminFormCrmRouter } from "./routes/adminFormCrmRoutes.mjs";
import { projectWorkflowRouter } from "./routes/projectWorkflowRoutes.mjs";
import { projectShareRouter } from "./routes/projectShareRoutes.mjs";
import { adminDesignerRouter } from "./routes/adminDesignerRoutes.mjs";
import { seedIfEmpty } from "./seed/seed.mjs";
import { log } from "./observability/logger.mjs";
import { sendAlert } from "./observability/alerts.mjs";
import { requestContext } from "./middleware/requestContext.mjs";
import { httpMetrics } from "./middleware/httpMetrics.mjs";
import { reloadStripeFromSystemConfig } from "./services/stripeService.mjs";
import { normalizeLegacyClosedSupportTickets } from "./services/supportTicketMaintenance.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../../dist");

export const app = express();

app.set("trust proxy", 1);

// Default Helmet: deny framing of the app shell (admin/customer surfaces).
const defaultHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "frame-ancestors": ["'self'"],
      // Allow HTTP access (e.g. EC2 IP before DNS/HTTPS). Default upgrade breaks JS on http://IP.
      "upgrade-insecure-requests": null,
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

// Public embed pages (and embed API) need cross-origin framing for the lead-form iframe to work on customer sites.
const embeddableHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "frame-ancestors": ["*"],
      "upgrade-insecure-requests": null,
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

app.use((req, res, next) => {
  const p = req.path || "";
  if (p.startsWith("/embed/form/") || p.startsWith("/api/forms/") || p.startsWith("/api/v1/forms/")) {
    return embeddableHelmet(req, res, next);
  }
  return defaultHelmet(req, res, next);
});
const corsOrigins =
  env.nodeEnv === "development"
    ? [
        env.appUrl,
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:4173",
        ...env.allowedRedirectOrigins,
      ]
    : [...new Set([env.appUrl, ...env.allowedRedirectOrigins])];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(requestContext);
app.use(httpMetrics);
app.use(cookieParser());

app.use("/api", healthRouter);

// Webhooks must not be throttled by the global limiter; providers retry on non-2xx and can drift state if 429'd.
app.use("/api/webhooks", webhookRouter);
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 400 }));

app.use("/api/auth", authRouter);
app.use("/api/forms", formPublicRouter);
app.use("/api/v1/forms", formPublicRouter);
app.use("/api/subscriptions", subscriptionRouter);
// Public read-only project share view (token-gated, no auth) — mount BEFORE the auth-required project routers.
app.use("/api/share", projectShareRouter);
// Project workflow / chat / approval / finance / settings — owner-or-staff guarded internally.
app.use("/api/projects", projectWorkflowRouter);
app.use("/api/projects", projectRouter);
app.use("/api/documents", clientDocumentRouter);
// Tickets router first: other admin routers apply admin-only role guards to all /api/admin paths.
app.use("/api/admin", adminSupportRouter);
app.use("/api/admin", adminClientDocumentRouter);
app.use("/api/admin", adminProjectRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin", adminFormCrmRouter);
app.use("/api/admin/designer", adminDesignerRouter);
app.use("/api/support", supportRouter);

/** Single-host production: API + Vite `dist` on one process (nginx proxies :443 → env.port). */
if (env.nodeEnv === "production") {
  app.use(express.static(distPath, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api\/).*/, (_req, res, next) => {
    res.sendFile(path.join(distPath, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

app.use((err, req, res, _next) => {
  log.error("request.unhandled", {
    requestId: req?.requestId,
    path: req?.path,
    error: err?.message,
  });
  if (env.alertOnInternalError) {
    void sendAlert({
      event: "request.unhandled",
      requestId: req?.requestId,
      detail: { message: err?.message, path: req?.path },
    });
  }
  res.status(500).json({ error: "internal_server_error", message: "Unexpected server error." });
});

export async function startServer() {
  await connectDb();
  await normalizeLegacyClosedSupportTickets();
  await reloadStripeFromSystemConfig();
  await seedIfEmpty();
  if (env.stripeSecretKey && !String(env.stripeWebhookSecret || "").trim()) {
    log.warn("stripe.webhook_secret_missing", {
      hint: "Set STRIPE_WEBHOOK_SECRET (whsec_ from `npm run stripe:listen` or Dashboard) so checkout updates the DB; or use /api/subscriptions/sync-stripe",
    });
  }
  const listenHost = process.env.HOST ?? "0.0.0.0";
  app.listen(env.port, listenHost, () => {
    log.info("api.started", { port: env.port, environment: env.nodeEnv });
  });
}
