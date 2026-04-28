import jwt from "jsonwebtoken";
import { env } from "../config/env.mjs";

export function issueFormCsrfToken(embedKey) {
  return jwt.sign({ typ: "form_csrf", ek: embedKey }, env.formCsrfSecret, { expiresIn: "45m" });
}

export function verifyFormCsrfToken(token, embedKey) {
  if (!token || typeof token !== "string") return false;
  try {
    const p = jwt.verify(token, env.formCsrfSecret);
    return p?.typ === "form_csrf" && p?.ek === embedKey;
  } catch {
    return false;
  }
}
