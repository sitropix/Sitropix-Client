import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.mjs";

function userId(user) {
  return String(user.id ?? user._id);
}

export function signAccessToken(user) {
  return jwt.sign({ sub: userId(user), role: user.role, email: user.email }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessTtl,
  });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: userId(user), type: "refresh", jti: randomUUID() }, env.jwtRefreshSecret, {
    expiresIn: `${env.jwtRefreshTtlDays}d`,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}
