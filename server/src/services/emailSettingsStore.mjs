import { prisma } from "../db/client.mjs";
import { env } from "../config/env.mjs";
import { assertSecretsKeyConfiguredForAdminSave, decryptSecretsJson, encryptSecretsJson } from "./emailSecrets.mjs";

const ID = "default";

function maskSecret(value) {
  if (!value || typeof value !== "string") return null;
  if (value.length <= 4) return "********";
  return `********${value.slice(-4)}`;
}

export async function getEmailSettingsRow() {
  return prisma.emailSettings.findUnique({ where: { id: ID } });
}

/** Admin UI payload (no raw secrets). */
export async function getAdminEmailSettingsPayload() {
  const row = await getEmailSettingsRow();
  if (!row) {
    return {
      configuredInDatabase: false,
      provider: env.emailProvider,
      fromEmail: env.emailFrom,
      fromName: "",
      settings: {},
      secretMasks: {},
      hint: "Using environment variables. Saving below will store settings in the database for this deployment.",
    };
  }

  let secretMasks = {};
  if (row.secretsEncrypted) {
    try {
      const s = decryptSecretsJson(row.secretsEncrypted);
      secretMasks = Object.fromEntries(Object.keys(s).map((k) => [k, maskSecret(s[k])]));
    } catch {
      secretMasks = { _error: "Could not decrypt stored secrets. Check EMAIL_SECRETS_KEY matches the key used when saving." };
    }
  }

  return {
    configuredInDatabase: true,
    provider: row.provider,
    fromEmail: row.fromEmail,
    fromName: row.fromName,
    settings: (row.settingsJson && typeof row.settingsJson === "object" ? row.settingsJson : {}) ?? {},
    secretMasks,
    hint: null,
  };
}

/**
 * Merge admin PATCH: non-empty secret strings replace; omitted or empty string = keep previous value for that key.
 * Pass secrets: null to skip secret updates entirely.
 */
function secretKeysForProvider(provider) {
  switch (provider) {
    case "smtp":
      return ["smtpPassword"];
    case "brevo":
      return ["brevoApiKey"];
    case "mailgun":
      return ["mailgunApiKey"];
    case "resend":
      return ["resendApiKey"];
    case "sendgrid":
      return ["sendgridApiKey"];
    default:
      return [];
  }
}

export async function saveAdminEmailSettings({ provider, fromEmail, fromName, settings, secrets }) {
  assertSecretsKeyConfiguredForAdminSave();

  const allowed = secretKeysForProvider(provider);
  const existing = await getEmailSettingsRow();
  let prevAll = {};
  if (existing?.secretsEncrypted) {
    try {
      prevAll = decryptSecretsJson(existing.secretsEncrypted);
    } catch {
      prevAll = {};
    }
  }

  const secretsObj = {};
  for (const k of allowed) {
    if (prevAll[k]) secretsObj[k] = prevAll[k];
  }

  if (secrets && typeof secrets === "object") {
    for (const k of allowed) {
      const v = secrets[k];
      if (v === undefined || v === null) continue;
      if (typeof v !== "string") continue;
      const t = v.trim();
      if (t.length === 0) continue;
      secretsObj[k] = t;
    }
  }

  const enc = Object.keys(secretsObj).length > 0 ? encryptSecretsJson(secretsObj) : null;

  await prisma.emailSettings.upsert({
    where: { id: ID },
    create: {
      id: ID,
      provider,
      fromEmail: fromEmail ?? "",
      fromName: fromName ?? "",
      settingsJson: settings && typeof settings === "object" ? settings : {},
      secretsEncrypted: enc,
    },
    update: {
      provider,
      fromEmail: fromEmail ?? "",
      fromName: fromName ?? "",
      settingsJson: settings && typeof settings === "object" ? settings : {},
      secretsEncrypted: enc,
    },
  });
}

/** Decrypted secrets + row fields for sending (internal). */
export async function getResolvedDbEmailConfig() {
  const row = await getEmailSettingsRow();
  if (!row || row.provider === "console") return null;
  let secrets = {};
  if (row.secretsEncrypted) {
    try {
      secrets = decryptSecretsJson(row.secretsEncrypted);
    } catch {
      return { error: "decrypt_failed", row };
    }
  }
  const settings = (row.settingsJson && typeof row.settingsJson === "object" ? row.settingsJson : {}) ?? {};
  return { row, secrets, settings };
}
