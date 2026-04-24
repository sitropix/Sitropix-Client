import { Resend } from "resend";
import nodemailer from "nodemailer";
import { prisma } from "../db/client.mjs";
import { env } from "../config/env.mjs";
import { getResolvedDbEmailConfig } from "./emailSettingsStore.mjs";

const resendEnv = env.resendApiKey ? new Resend(env.resendApiKey) : null;

function formatFrom(name, email) {
  const e = (email || "").trim();
  if (!e) return env.emailFrom;
  const n = (name || "").trim();
  if (n) return `${n} <${e}>`;
  return e;
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
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    await transporter.sendMail({ from, to, subject, html });
    return;
  }

  if (provider === "brevo") {
    const apiKey = String(secrets.brevoApiKey ?? "").trim();
    if (!apiKey) throw new Error("brevo_incomplete");
    const senderEmail = row.fromEmail || env.emailFrom;
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: row.fromName || undefined, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!r.ok) throw new Error(`brevo_failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return;
  }

  if (provider === "mailgun") {
    const apiKey = String(secrets.mailgunApiKey ?? "").trim();
    const domain = String(settings.mailgunDomain ?? "").trim();
    const region = String(settings.mailgunRegion ?? "us").toLowerCase() === "eu" ? "eu" : "us";
    if (!apiKey || !domain) throw new Error("mailgun_incomplete");
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
    const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }], subject }],
        from: { email: row.fromEmail || env.emailFrom, name: row.fromName || undefined },
        content: [{ type: "text/html", value: html }],
      }),
    });
    if (!r.ok) throw new Error(`sendgrid_failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return;
  }

  throw new Error(`unknown_email_provider:${provider}`);
}

async function sendWithEnvFallback({ to, subject, html }) {
  if (env.emailProvider === "resend" && resendEnv) {
    await resendEnv.emails.send({ from: env.emailFrom, to, subject, html });
    return;
  }
  if (env.emailProvider === "sendgrid" && env.sendgridApiKey) {
    const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }], subject }],
        from: { email: env.emailFrom },
        content: [{ type: "text/html", value: html }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`sendgrid_failed: ${r.status} ${t.slice(0, 200)}`);
    }
    return;
  }
  console.log(JSON.stringify({ level: "info", msg: "email.console", to, subject: subject?.slice(0, 60) }));
}

/**
 * Send transactional email with optional idempotency (prevents duplicate sends on retries).
 * Uses database email settings when configured; otherwise environment (EMAIL_PROVIDER, etc.).
 */
export async function sendTransactionalEmail({ to, subject, html, template, idempotencyKey }) {
  if (!to) return { skipped: true };

  if (idempotencyKey) {
    const existing = await prisma.emailLog.findUnique({ where: { idempotencyKey } });
    if (existing) return { deduped: true };
  }

  let sent = false;
  let used = "console";

  try {
    const db = await getResolvedDbEmailConfig();
    if (db?.error === "decrypt_failed") {
      console.error(JSON.stringify({ level: "error", msg: "email.db_decrypt_failed" }));
    } else if (db && !db.error && db.row?.provider && db.row.provider !== "console") {
      await sendWithDbConfig({ to, subject, html }, db);
      used = `db:${db.row.provider}`;
      sent = true;
    } else {
      await sendWithEnvFallback({ to, subject, html });
      used = env.emailProvider;
      sent = true;
    }
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "email.send_failed", error: e?.message, used }));
    try {
      await sendWithEnvFallback({ to, subject, html });
      used = `${used}_env_fallback`;
      sent = true;
    } catch (e2) {
      console.error(JSON.stringify({ level: "error", msg: "email.fallback_failed", error: e2?.message }));
    }
  }

  if (idempotencyKey && sent) {
    await prisma.emailLog.create({
      data: { toEmail: to, template: template ?? "generic", idempotencyKey },
    });
  }
  return { sent, used };
}

/** @deprecated use sendTransactionalEmail */
export async function sendEmail({ to, subject, html }) {
  return sendTransactionalEmail({ to, subject, html, template: "legacy" });
}
