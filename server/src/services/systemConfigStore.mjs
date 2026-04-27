import { prisma } from "../db/client.mjs";
import { assertSecretsKeyConfiguredForAdminSave, decryptSecretsJson, encryptSecretsJson } from "./emailSecrets.mjs";

const DEFS = [
  { key: "DATABASE_URL", isSecret: true },
  { key: "STRIPE_SECRET_KEY", isSecret: true },
  { key: "STRIPE_WEBHOOK_SECRET", isSecret: true },
  { key: "STRIPE_SUCCESS_URL", isSecret: false },
  { key: "STRIPE_CANCEL_URL", isSecret: false },
  { key: "APP_URL", isSecret: false },
  { key: "API_URL", isSecret: false },
  { key: "EMAIL_PROVIDER", isSecret: false },
  { key: "EMAIL_FROM", isSecret: false },
  { key: "RESEND_API_KEY", isSecret: true },
  { key: "SENDGRID_API_KEY", isSecret: true },
  { key: "ALLOWED_REDIRECT_ORIGINS", isSecret: false },
];

function maskSecret(value) {
  if (!value) return null;
  if (value.length <= 4) return "********";
  return `********${value.slice(-4)}`;
}

export async function getSystemConfigPayload() {
  const rows = await prisma.systemConfig.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return {
    items: DEFS.map((def) => {
      const row = byKey.get(def.key);
      if (!row) {
        return {
          key: def.key,
          isSecret: def.isSecret,
          configuredInDatabase: false,
          value: "",
          secretMask: null,
        };
      }
      if (def.isSecret) {
        let raw = "";
        if (row.valueEncrypted) {
          try {
            const obj = decryptSecretsJson(row.valueEncrypted);
            raw = String(obj.value ?? "");
          } catch {
            raw = "";
          }
        }
        return {
          key: def.key,
          isSecret: true,
          configuredInDatabase: true,
          value: "",
          secretMask: maskSecret(raw),
        };
      }
      return {
        key: def.key,
        isSecret: false,
        configuredInDatabase: true,
        value: row.valuePlain ?? "",
        secretMask: null,
      };
    }),
  };
}

export async function saveSystemConfig(items) {
  assertSecretsKeyConfiguredForAdminSave();
  for (const item of items) {
    if (item.isSecret) {
      const value = item.value?.trim();
      if (!value) continue; // keep existing secret when blank
      const encrypted = encryptSecretsJson({ value });
      await prisma.systemConfig.upsert({
        where: { key: item.key },
        create: { key: item.key, isSecret: true, valueEncrypted: encrypted, valuePlain: null },
        update: { isSecret: true, valueEncrypted: encrypted, valuePlain: null },
      });
    } else {
      await prisma.systemConfig.upsert({
        where: { key: item.key },
        create: { key: item.key, isSecret: false, valuePlain: item.value ?? "", valueEncrypted: null },
        update: { isSecret: false, valuePlain: item.value ?? "", valueEncrypted: null },
      });
    }
  }
}

