import { Resend } from "resend";
import nodemailer from "nodemailer";
import { prisma } from "../db/client.mjs";
import { env } from "../config/env.mjs";
import { log } from "../observability/logger.mjs";
import { getResolvedDbEmailConfig } from "./emailSettingsStore.mjs";

const resendEnv = env.resendApiKey ? new Resend(env.resendApiKey) : null;

function formatFrom(name, email) {
  const e = (email || "").trim();
  if (!e) return env.emailFrom;
  const n = (name || "").trim();
  if (n) return `${n} <${e}>`;
  return e;
}

async function sendSmtp({ from, to, subject, html }, { host, port, secure, user, pass }) {
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  await transporter.sendMail({ from, to, subject, html });
}

async function sendBrevoApi(apiKey, senderEmail, senderName, to, subject, html) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: senderName || undefined, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!r.ok) throw new Error(`brevo_failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

async function sendMailgunApi(apiKey, domain, region, from, to, subject, html) {
  const base = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
  const body = new URLSearchParams();
  body.set("from", from);
  body.set("to", to);
  body.set("subject", subject);
  body.set("html", html);
  const r = await fetch(`${base}/v3/${encodeURIComponent(domain)}/messages`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}` },
    body,
  });
  if (!r.ok) throw new Error(`mailgun_failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

async function sendSendgridApi(apiKey, fromEmail, fromName, to, subject, html) {
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: fromName || undefined },
      subject,
      content: [{ type: "text/html", value: html }],
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`sendgrid_failed: ${r.status} ${t.slice(0, 200)}`);
  }
}

async function sendWithDbConfig({ to, subject, html }, cfg) {
  const { row, secrets, settings } = cfg;
  const from = formatFrom(row.fromName, row.fromEmail || env.emailFrom);
  const provider = row.provider;

  if (provider === "smtp") {
    const host = String(settings.smtpHost ?? "").trim();
    const port = Number(settings.smtpPort ?? 587);
    const secure = Boolean(settings.smtpSecure);
    const user = String(settings.smtpUser ?? secrets.smtpUser ?? "").trim();
    const pass = String(secrets.smtpPassword ?? "").trim();
    if (!host || !pass || !user) throw new Error("smtp_incomplete");
    await sendSmtp({ from, to, subject, html }, { host, port, secure, user, pass });
    return;
  }

  if (provider === "brevo") {
    const apiKey = String(secrets.brevoApiKey ?? "").trim();
    if (!apiKey) throw new Error("brevo_incomplete");
    const senderEmail = row.fromEmail || env.emailFrom;
    await sendBrevoApi(apiKey, senderEmail, row.fromName, to, subject, html);
    return;
  }

  if (provider === "mailgun") {
    const apiKey = String(secrets.mailgunApiKey ?? "").trim();
    const domain = String(settings.mailgunDomain ?? "").trim();
    const region = String(settings.mailgunRegion ?? "us").toLowerCase() === "eu" ? "eu" : "us";
    if (!apiKey || !domain) throw new Error("mailgun_incomplete");
    await sendMailgunApi(apiKey, domain, region, from, to, subject, html);
    return;
  }

  if (provider === "resend") {
    const apiKey = String(secrets.resendApiKey ?? "").trim();
    if (!apiKey) throw new Error("resend_incomplete");
    const client = new Resend(apiKey);
    await client.emails.send({ from, to, subject, html });
    return;
  }

  if (provider === "sendgrid") {
    const apiKey = String(secrets.sendgridApiKey ?? "").trim();
    if (!apiKey) throw new Error("sendgrid_incomplete");
    await sendSendgridApi(apiKey, row.fromEmail || env.emailFrom, row.fromName, to, subject, html);
    return;
  }

  throw new Error(`unknown_email_provider:${provider}`);
}

/**
 * Send using process env (EMAIL_PROVIDER + provider-specific vars).
 * @returns {{ delivered: boolean, used: string }}
 */
async function sendWithEnvFallback({ to, subject, html }) {
  const provider = String(env.emailProvider || "console").toLowerCase();

  if (provider === "resend" && resendEnv) {
    await resendEnv.emails.send({ from: env.emailFrom, to, subject, html });
    return { delivered: true, used: "resend" };
  }

  if (provider === "sendgrid" && env.sendgridApiKey) {
    await sendSendgridApi(env.sendgridApiKey, env.emailFrom, "", to, subject, html);
    return { delivered: true, used: "sendgrid" };
  }

  if (provider === "smtp") {
    const host = String(process.env.SMTP_HOST ?? "").trim();
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure =
      String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true" || port === 465;
    const user = String(process.env.SMTP_USER ?? "").trim();
    const pass = String(process.env.SMTP_PASSWORD ?? "").trim();
    if (host && user && pass) {
      await sendSmtp({ from: env.emailFrom, to, subject, html }, { host, port, secure, user, pass });
      return { delivered: true, used: "smtp" };
    }
    log.warn("email.smtp_env_incomplete", { hint: "Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD for EMAIL_PROVIDER=smtp." });
  }

  if (provider === "brevo") {
    const apiKey = String(process.env.BREVO_API_KEY ?? "").trim();
    if (apiKey) {
      await sendBrevoApi(apiKey, env.emailFrom, "", to, subject, html);
      return { delivered: true, used: "brevo" };
    }
    log.warn("email.brevo_env_missing", { hint: "Set BREVO_API_KEY when EMAIL_PROVIDER=brevo." });
  }

  if (provider === "mailgun") {
    const apiKey = String(process.env.MAILGUN_API_KEY ?? "").trim();
    const domain = String(process.env.MAILGUN_DOMAIN ?? "").trim();
    const region = String(process.env.MAILGUN_REGION ?? "us").toLowerCase() === "eu" ? "eu" : "us";
    if (apiKey && domain) {
      await sendMailgunApi(apiKey, domain, region, env.emailFrom, to, subject, html);
      return { delivered: true, used: "mailgun" };
    }
    log.warn("email.mailgun_env_missing", {
      hint: "Set MAILGUN_API_KEY and MAILGUN_DOMAIN when EMAIL_PROVIDER=mailgun.",
    });
  }

  if (provider !== "console") {
    log.warn("email.fallback_console", {
      provider,
      to,
      subject: subject?.slice(0, 80),
      hint: "No working env email transport; set RESEND_API_KEY, SENDGRID_API_KEY, SMTP_*, BREVO_API_KEY, or MAILGUN_* as appropriate.",
    });
  }
  log.info("email.console", { to, subject: subject?.slice(0, 60) });
  return { delivered: false, used: "console" };
}

/**
 * Send transactional email with optional idempotency (prevents duplicate sends on retries).
 * Uses database email settings when configured; otherwise environment (EMAIL_PROVIDER, etc.).
 * @returns {Promise<{ sent?: boolean; delivered?: boolean; used?: string; skipped?: boolean; deduped?: boolean }>}
 */
export async function sendTransactionalEmail({ to, subject, html, template, idempotencyKey }) {
  if (!to) return { skipped: true };

  if (idempotencyKey) {
    const existing = await prisma.emailLog.findUnique({ where: { idempotencyKey } });
    if (existing) return { deduped: true, sent: false };
  }

  let delivered = false;
  let used = "console";

  try {
    const db = await getResolvedDbEmailConfig();
    if (db?.error === "decrypt_failed") {
      log.error("email.db_decrypt_failed", {});
      // If stored secrets can't be decrypted (wrong EMAIL_SECRETS_KEY),
      // fall back to env-based configuration instead of silently doing nothing.
      const fb = await sendWithEnvFallback({ to, subject, html });
      used = fb.used;
      delivered = fb.delivered;
    } else if (db && !db.error && db.row?.provider && db.row.provider !== "console") {
      await sendWithDbConfig({ to, subject, html }, db);
      used = `db:${db.row.provider}`;
      delivered = true;
    } else {
      const fb = await sendWithEnvFallback({ to, subject, html });
      used = fb.used;
      delivered = fb.delivered;
    }
  } catch (e) {
    log.error("email.send_failed", { error: e?.message, used });
    try {
      const fb = await sendWithEnvFallback({ to, subject, html });
      used = `${used}_env_fallback:${fb.used}`;
      delivered = fb.delivered;
    } catch (e2) {
      log.error("email.fallback_failed", { error: e2?.message });
    }
  }

  if (idempotencyKey && delivered) {
    await prisma.emailLog.create({
      data: { toEmail: to, template: template ?? "generic", idempotencyKey },
    });
  }
  return { sent: delivered, delivered, used };
}

/** @deprecated use sendTransactionalEmail */
export async function sendEmail({ to, subject, html }) {
  return sendTransactionalEmail({ to, subject, html, template: "legacy" });
}
