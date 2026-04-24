import dotenv from "dotenv";

dotenv.config();

const DEV_ACCESS_SECRET = "dev_access_secret_change_me";
const DEV_REFRESH_SECRET = "dev_refresh_secret_change_me";

function required(name, fallback = "") {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.API_SERVER_PORT ?? 8787),
  databaseUrl: required("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5432/sitropix_portal"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", DEV_ACCESS_SECRET),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", DEV_REFRESH_SECRET),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  jwtRefreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 14),
  appUrl: process.env.APP_URL ?? "http://127.0.0.1:5173",
  apiUrl: process.env.API_URL ?? "http://127.0.0.1:8787",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripeSuccessUrl: process.env.STRIPE_SUCCESS_URL ?? "http://127.0.0.1:5173/billing",
  stripeCancelUrl: process.env.STRIPE_CANCEL_URL ?? "http://127.0.0.1:5173/subscription",
  emailProvider: process.env.EMAIL_PROVIDER ?? "console",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "noreply@example.com",
  sendgridApiKey: process.env.SENDGRID_API_KEY ?? "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  clientDocumentsDir: process.env.CLIENT_DOCUMENTS_DIR ?? "data/client-documents",
  auditLogEnabled: (process.env.AUDIT_LOG_ENABLED ?? "true").toLowerCase() === "true",
};

function assertProductionSecurity() {
  if (env.nodeEnv !== "production") return;

  if (env.jwtAccessSecret === DEV_ACCESS_SECRET || env.jwtRefreshSecret === DEV_REFRESH_SECRET) {
    throw new Error("Insecure JWT secrets detected in production. Set strong JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.");
  }

  if (!String(env.databaseUrl || "").trim()) {
    throw new Error("DATABASE_URL is required in production.");
  }

  if (!String(env.appUrl || "").trim()) {
    throw new Error("APP_URL is required in production.");
  }
}

assertProductionSecurity();
