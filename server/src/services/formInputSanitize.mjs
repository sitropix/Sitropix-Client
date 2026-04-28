/**
 * Strip risky control chars and simple HTML-like fragments before persistence.
 */
export function sanitizeStringInput(s, maxLen = 50_000) {
  if (typeof s !== "string") return s;
  let t = s.trim().slice(0, maxLen);
  t = t.replace(/<[^>]*>/g, "");
  t = t.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  return t;
}

export function sanitizePayloadValues(record) {
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === "string") out[k] = sanitizeStringInput(v);
    else out[k] = v;
  }
  return out;
}
