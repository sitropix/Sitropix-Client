import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.mjs";
import { connectDb } from "./config/db.mjs";
import { authRouter } from "./routes/authRoutes.mjs";
import { subscriptionRouter, adminRouter } from "./routes/subscriptionRoutes.mjs";
import { clientDocumentRouter, adminClientDocumentRouter } from "./routes/clientDocumentRoutes.mjs";
import { adminSupportRouter } from "./routes/adminSupportRoutes.mjs";
import { supportRouter } from "./routes/supportRoutes.mjs";
import { webhookRouter } from "./routes/webhookRoutes.mjs";
import { seedIfEmpty } from "./seed/seed.mjs";

export const app = express();

app.set("trust proxy", 1);
app.use(helmet());
const corsOrigins =
  env.nodeEnv === "development"
    ? [env.appUrl, "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:4173"]
    : [env.appUrl];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 400 }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true, mode: env.nodeEnv }));

app.use("/api/webhooks", webhookRouter);
app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", authRouter);
app.use("/api/subscriptions", subscriptionRouter);
app.use("/api/documents", clientDocumentRouter);
app.use("/api/admin", adminClientDocumentRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin", adminSupportRouter);
app.use("/api/support", supportRouter);

app.use((err, _req, res, _next) => {
  console.error(JSON.stringify({ level: "error", msg: "request.failed", error: err?.message }));
  res.status(500).json({ error: "internal_server_error" });
});

export async function startServer() {
  await connectDb();
  await seedIfEmpty();
  if (env.stripeSecretKey && !String(env.stripeWebhookSecret || "").trim()) {
    console.warn(
      JSON.stringify({
        level: "warn",
        msg: "stripe.webhook_secret_missing",
        hint: "Set STRIPE_WEBHOOK_SECRET (whsec_ from `npm run stripe:listen` or Dashboard) so checkout updates the DB; or use /api/subscriptions/sync-stripe",
      }),
    );
  }
  const listenHost = process.env.HOST ?? "0.0.0.0";
  app.listen(env.port, listenHost, () => {
    console.log(JSON.stringify({ level: "info", msg: "api.started", port: env.port }));
  });
}
