import { env } from "../config/env.mjs";

const SERVICE = "sitropix-portal-api";

function line(level, msg, fields) {
  const out = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
    msg,
    ...fields,
  };
  const s = JSON.stringify(out);
  if (level === "error" || level === "fatal") {
    // eslint-disable-next-line no-console
    console.error(s);
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(s);
  } else {
    // eslint-disable-next-line no-console
    console.log(s);
  }
  return s;
}

export const log = {
  /** @param {string} msg
   *  @param {Record<string, unknown>} [fields] */
  info(msg, fields = {}) {
    if (Object.keys(fields).length) line("info", msg, fields);
    else line("info", msg, {});
  },
  /** @param {string} msg
   *  @param {Record<string, unknown>} [fields] */
  warn(msg, fields = {}) {
    line("warn", msg, fields);
  },
  /** @param {string} msg
   *  @param {Record<string, unknown>} [fields] */
  error(msg, fields = {}) {
    line("error", msg, fields);
  },
  /** @param {string} msg
   *  @param {Record<string, unknown>} [fields] */
  fatal(msg, fields = {}) {
    line("fatal", msg, fields);
  },
  /** Merge request-scoped id into a field object (non-throwing if req missing). */
  withReq(req, fields = {}) {
    if (!req) return fields;
    const requestId = req.requestId;
    if (!requestId) return fields;
    return { requestId, ...fields };
  },
  /** @param {import('express').Request} [req] */
  infoReq(req, msg, fields = {}) {
    log.info(msg, log.withReq(req, fields));
  },
  /** @param {import('express').Request} [req] */
  warnReq(req, msg, fields = {}) {
    log.warn(msg, log.withReq(req, fields));
  },
  /** @param {import('express').Request} [req] */
  errorReq(req, msg, fields = {}) {
    log.error(msg, log.withReq(req, fields));
  },
  /** In production, skip very chatty access-style logs unless explicit. */
  shouldLogDebug() {
    return env.nodeEnv !== "production";
  },
};
