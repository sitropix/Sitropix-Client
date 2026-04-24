import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function keyBuffer() {
  const raw = process.env.EMAIL_SECRETS_KEY ?? "";
  if (raw.length >= 32) return Buffer.from(raw.slice(0, 32), "utf8");
  return crypto.createHash("sha256").update(raw || "dev-email-secrets-fallback-change-me").digest();
}

export function encryptSecretsJson(obj) {
  const plain = JSON.stringify(obj ?? {});
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, keyBuffer(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecretsJson(blob) {
  if (!blob) return {};
  const buf = Buffer.from(blob, "base64");
  if (buf.length < 28) throw new Error("invalid_secrets_blob");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, keyBuffer(), iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(json);
}

export function assertSecretsKeyConfiguredForAdminSave() {
  const raw = (process.env.EMAIL_SECRETS_KEY ?? "").trim();
  if (raw.length < 16) {
    throw new Error("email_secrets_key_missing");
  }
}
