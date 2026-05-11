import { z } from "zod";

const MAX_FILE_BASE64 = 600_000;
const MAX_PATTERN_LEN = 280;

function isE164(s) {
  return /^\+[1-9]\d{6,14}$/.test(s);
}

function isLoosePhone(s) {
  return /^[\d\s\-().+]{7,24}$/.test(s);
}

function readVj(field) {
  const v = field.validationJson && typeof field.validationJson === "object" ? field.validationJson : {};
  return v;
}

/** Text/textarea answers that should be validated (and stored) as RFC-style emails. */
export function textFieldValidatesAsEmail(field) {
  if (field.type !== "text" && field.type !== "textarea") return false;
  const vj = readVj(field);
  if (vj.format === "email") return true;
  const kl = String(field.key || "").toLowerCase();
  return kl === "email" || kl === "e_mail" || kl.endsWith("_email");
}

/** Fields whose primary value is an email address (typed or configured text). */
export function fieldSuppliesEmailAddress(field) {
  if (field.type === "email") return true;
  return textFieldValidatesAsEmail(field);
}

export function isValidEmailString(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  return z.string().email().safeParse(s).success;
}

/** After type checks, enforce admin-configured constraints. Mutates issues; may delete invalid keys from `out`. */
function refineConstraints(fields, out, issues) {
  for (const f of fields) {
    if (f.type === "hidden") continue;
    const v = out[f.key];
    if (v === undefined) continue;
    const vj = readVj(f);

    if (f.type === "file") continue;

    if (typeof v === "string") {
      const msg = refineStringConstraints(v, vj);
      if (msg) {
        issues.push({ key: f.key, message: msg });
        delete out[f.key];
      }
      continue;
    }

    if (typeof v === "number") {
      const msg = refineNumberConstraints(v, vj);
      if (msg) {
        issues.push({ key: f.key, message: msg });
        delete out[f.key];
      }
    }
  }
}

function refineStringConstraints(s, vj) {
  const minL = Number(vj.minLength);
  const maxL = Number(vj.maxLength);
  if (Number.isFinite(minL) && s.length < minL) return "min_length";
  if (Number.isFinite(maxL) && s.length > maxL) return "max_length";

  const patRaw = typeof vj.pattern === "string" ? vj.pattern.trim() : "";
  if (patRaw.length > MAX_PATTERN_LEN) return null;
  if (patRaw) {
    try {
      const re = new RegExp(patRaw);
      if (!re.test(s)) return "pattern";
    } catch {
      /* invalid pattern from admin config */
    }
  }
  return null;
}

function refineNumberConstraints(n, vj) {
  const min = Number(vj.min);
  const max = Number(vj.max);
  if (Number.isFinite(min) && n < min) return "min_value";
  if (Number.isFinite(max) && n > max) return "max_value";
  return null;
}

/**
 * Validates answers against form field definitions (including server-side hidden defaults).
 */
export function validateFormAnswers(fields, answers) {
  const issues = [];
  const out = {};

  for (const f of fields) {
    if (f.type === "hidden") continue;

    const raw = answers[f.key];
    const vj = readVj(f);

    if (f.type === "checkbox") {
      const v = raw === true || raw === "true" || raw === "on" || raw === "1" || raw === 1;
      if (f.required && !v) issues.push({ key: f.key, message: "required" });
      out[f.key] = v;
      continue;
    }

    if (raw === undefined || raw === null || raw === "") {
      if (f.required) issues.push({ key: f.key, message: "required" });
      continue;
    }

    if (f.type === "email") {
      const s = String(raw).trim();
      if (!z.string().email().safeParse(s).success) issues.push({ key: f.key, message: "invalid_email" });
      else out[f.key] = s;
      continue;
    }

    if (f.type === "tel" || f.type === "phone") {
      const s = String(raw).trim();
      const strict = vj.strictE164 === true;
      if (strict && !isE164(s)) issues.push({ key: f.key, message: "invalid_phone_e164" });
      else if (!strict && !isE164(s) && !isLoosePhone(s)) issues.push({ key: f.key, message: "invalid_phone" });
      else out[f.key] = strict ? s : s.replace(/\s+/g, " ");
      continue;
    }

    if (f.type === "number") {
      const n = Number(raw);
      if (Number.isNaN(n)) issues.push({ key: f.key, message: "invalid_number" });
      else out[f.key] = n;
      continue;
    }

    if (f.type === "select") {
      const opts = Array.isArray(f.optionsJson) ? f.optionsJson : [];
      const s = String(raw);
      if (!opts.includes(s)) issues.push({ key: f.key, message: "invalid_option" });
      else out[f.key] = s;
      continue;
    }

    if (f.type === "date") {
      const s = String(raw).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) issues.push({ key: f.key, message: "invalid_date" });
      else out[f.key] = s;
      continue;
    }

    if (f.type === "file") {
      let s = String(raw).trim();
      if (s.startsWith("data:")) {
        const i = s.indexOf("base64,");
        if (i !== -1) s = s.slice(i + 7);
      }
      if (s.length > MAX_FILE_BASE64) issues.push({ key: f.key, message: "file_too_large" });
      else out[f.key] = s;
      continue;
    }

    if (textFieldValidatesAsEmail(f)) {
      const s = String(raw).trim();
      if (!z.string().email().safeParse(s).success) issues.push({ key: f.key, message: "invalid_email" });
      else out[f.key] = s;
      continue;
    }

    out[f.key] = typeof raw === "string" ? raw.trim() : raw;
  }

  for (const f of fields) {
    if (f.type !== "hidden") continue;
    const vj = readVj(f);
    const dv = vj.defaultValue != null ? String(vj.defaultValue) : "";
    out[f.key] = dv.slice(0, 2000);
  }

  refineConstraints(fields, out, issues);

  return { values: out, issues };
}
