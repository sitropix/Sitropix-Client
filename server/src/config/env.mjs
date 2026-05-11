import dotenv from "dotenv";

dotenv.config();

const DEV_ACCESS_SECRET = "dev_access_secret_change_me";
const DEV_REFRESH_SECRET = "dev_refresh_secret_change_me";

function required(name, fallback = "") {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function normalizeOrigin(urlLike) {
  try {
    const parsed = new URL(urlLike);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function parseAllowedRedirectOrigins(appUrl) {
  const base = [normalizeOrigin(appUrl)].filter(Boolean);
  const extra = String(process.env.ALLOWED_REDIRECT_ORIGINS ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(normalizeOrigin)
    .filter(Boolean);
  return [...new Set([...base, ...extra])];
}

function optionalPositiveInt(name) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer when set.`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? process.env.API_SERVER_PORT ?? 8787),
  databaseUrl: required(
    "DATABASE_URL",
    "postgresql://postgres:Vamsi%401432@localhost:5432/postgres",
  ),
  prismaPoolConnectionLimit: optionalPositiveInt("PRISMA_POOL_CONNECTION_LIMIT"),
  prismaPoolTimeoutSeconds: optionalPositiveInt("PRISMA_POOL_TIMEOUT_SECONDS"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", DEV_ACCESS_SECRET),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", DEV_REFRESH_SECRET),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  jwtRefreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 14),
  appUrl: process.env.APP_URL ?? "http://127.0.0.1:5173",
  apiUrl: process.env.API_URL ?? "http://127.0.0.1:8787",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeSuccessUrl:
    process.env.STRIPE_SUCCESS_URL ?? "http://127.0.0.1:5173/billing",
  stripeCancelUrl:
    process.env.STRIPE_CANCEL_URL ?? "http://127.0.0.1:5173/subscription",
  emailProvider: process.env.EMAIL_PROVIDER ?? "console",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "noreply@example.com",
  sendgridApiKey: process.env.SENDGRID_API_KEY ?? "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  clientDocumentsDir:
    process.env.CLIENT_DOCUMENTS_DIR ?? "data/client-documents",
  auditLogEnabled:
    (process.env.AUDIT_LOG_ENABLED ?? "true").toLowerCase() === "true",
  /** Optional bearer for GET /api/metrics (if unset, route returns 404 in production, open in non-production) */
  metricsBearerToken: String(process.env.METRICS_BEARER_TOKEN ?? "").trim(),
  /** JSON POST for Slack/Discord/custom when critical failures occur (optional) */
  alertWebhookUrl: String(process.env.ALERT_WEBHOOK_URL ?? "").trim(),
  alertingEnabled:
    (process.env.ALERTING_ENABLED ?? "true").toLowerCase() !== "false",
  /** When true, POST to alert webhook for unhandled express errors (can be noisy) */
  alertOnInternalError:
    (process.env.ALERT_ON_INTERNAL_ERROR ?? "false").toLowerCase() === "true",
  /** HMAC/JWT signing for public form submit CSRF tokens (defaults to derived secret in dev). */
  formCsrfSecret:
    String(process.env.FORM_CSRF_SECRET ?? "").trim() ||
    `${String(process.env.JWT_ACCESS_SECRET ?? DEV_ACCESS_SECRET)}.form-csrf`,
  /** Set to `true` to skip CSRF on POST /api/forms/.../submit (local testing only). */
  formPublicCsrfDisabled:
    (process.env.FORM_PUBLIC_CSRF_DISABLED ?? "").toLowerCase() === "true",
  /** Cal.com API key (e.g. cal_live_...) — used server-side to enrich bookings after form submit. */
  calApiKey: String(process.env.CAL_API_KEY ?? "").trim(),
  /** Cal.com API v2 version header (see Cal docs). */
  calApiVersion: String(process.env.CAL_API_VERSION ?? "2024-08-13").trim(),
};
env.allowedRedirectOrigins = parseAllowedRedirectOrigins(env.appUrl);

function assertProductionSecurity() {
  if (env.nodeEnv !== "production") return;

  if (
    env.jwtAccessSecret === DEV_ACCESS_SECRET ||
    env.jwtRefreshSecret === DEV_REFRESH_SECRET
  ) {
    throw new Error(
      "Insecure JWT secrets detected in production. Set strong JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.",
    );
  }

  if (!String(env.databaseUrl || "").trim()) {
    throw new Error("DATABASE_URL is required in production.");
  }

  if (!String(env.appUrl || "").trim()) {
    throw new Error("APP_URL is required in production.");
  }

  if ((process.env.FORM_PUBLIC_CSRF_DISABLED ?? "").toLowerCase() === "true") {
    throw new Error(
      "FORM_PUBLIC_CSRF_DISABLED must not be enabled in production.",
    );
  }
}

assertProductionSecurity();
