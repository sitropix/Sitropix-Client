import bcrypt from "bcryptjs";
import express from "express";
import { prisma } from "../db/client.mjs";
import { validate } from "../middleware/validate.mjs";
import {
  loginSchema,
  requestResetSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from "../schemas/authSchemas.mjs";
import { sendTransactionalEmail } from "../services/emailService.mjs";
import { logAuditEvent, requestAuditContext } from "../services/auditLogService.mjs";
import { randomToken, sha256 } from "../utils/crypto.mjs";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/tokens.mjs";
import { env } from "../config/env.mjs";

const router = express.Router();

/** Public: validate invite link before signup (token from email). */
router.get("/invite-info", async (req, res) => {
  const token = String(req.query.token ?? "").trim();
  if (token.length < 16) return res.status(400).json({ error: "invalid_token" });
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: sha256(token) },
    include: { plan: { select: { id: true, name: true, code: true } } },
  });
  if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
    return res.status(404).json({ error: "invite_invalid" });
  }
  return res.json({
    email: invite.email,
    planId: invite.planId,
    planName: invite.plan?.name ?? null,
    planCode: invite.plan?.code ?? null,
    message: invite.message,
    expiresAt: invite.expiresAt,
  });
});

function setRefreshCookie(res, refreshToken) {
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: env.jwtRefreshTtlDays * 24 * 60 * 60 * 1000,
  });
}

async function persistRefreshToken(userId, refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
    },
  });
}

router.post("/signup", validate(signupSchema), async (req, res) => {
  const { name, email, password, inviteToken } = req.validatedBody;
  const emailLower = email.toLowerCase();

  let invite = null;
  if (inviteToken) {
    invite = await prisma.invite.findUnique({
      where: { tokenHash: sha256(inviteToken) },
      include: { plan: true },
    });
    if (!invite || invite.revokedAt || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: "invite_invalid" });
    }
    if (invite.email.toLowerCase() !== emailLower) {
      return res.status(400).json({ error: "invite_email_mismatch" });
    }
  }

  const existing = await prisma.user.findUnique({ where: { email: emailLower } });
  if (existing) return res.status(409).json({ error: "email_taken" });

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = randomToken(24);
  const user = await prisma.user.create({
    data: {
      name,
      email: emailLower,
      passwordHash,
      emailVerificationToken: sha256(verificationToken),
    },
  });
  const auditCtx = requestAuditContext(req);

  if (invite) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    await logAuditEvent({
      action: "invite.accepted",
      actorUserId: user.id,
      actorRole: user.role,
      targetType: "invite",
      targetId: invite.id,
      metadata: { email: user.email, planId: invite.planId ?? null },
      ...auditCtx,
    });
    if (invite.planId) {
      const hasSub = await prisma.subscription.findUnique({ where: { userId: user.id } });
      if (!hasSub) {
        const plan = await prisma.plan.findUnique({ where: { id: invite.planId } });
        if (plan) {
          const now = new Date();
          const end = new Date(now);
          end.setUTCDate(end.getUTCDate() + Math.max(1, plan.trialDays || 14));
          await prisma.subscription.create({
            data: {
              userId: user.id,
              planId: plan.id,
              status: "trialing",
              billingCycle: "monthly",
              currentPeriodStart: now,
              currentPeriodEnd: end,
            },
          });
        }
      }
    }
  }

  await sendTransactionalEmail({
    to: user.email,
    template: "signup_verify",
    idempotencyKey: `signup_verify_${user.id}`,
    subject: "Verify your account",
    html: `<p>Welcome ${user.name}.</p><p><a href="${env.appUrl}/verify-email?token=${verificationToken}">Verify your email</a></p>`,
  });

  return res.status(201).json({
    ok: true,
    message: "signup_success_verify_email",
    invitedPlanAttached: Boolean(invite?.planId),
  });
});

router.post("/verify-email", validate(verifyEmailSchema), async (req, res) => {
  const { token } = req.validatedBody;
  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: sha256(token) },
  });
  if (!user) return res.status(400).json({ error: "invalid_token" });
  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerificationToken: null },
  });
  return res.json({ ok: true });
});

router.post("/login", validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.validatedBody;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const auditCtx = requestAuditContext(req);
    if (!user) {
      await logAuditEvent({
        action: "auth.login_failed",
        targetType: "user",
        metadata: { email: email.toLowerCase(), reason: "user_not_found" },
        ...auditCtx,
      });
      return res.status(401).json({ error: "invalid_credentials" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await logAuditEvent({
        action: "auth.login_failed",
        actorUserId: user.id,
        actorRole: user.role,
        targetType: "user",
        targetId: user.id,
        metadata: { email: user.email, reason: "invalid_password" },
        ...auditCtx,
      });
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await persistRefreshToken(user.id, refreshToken);
    setRefreshCookie(res, refreshToken);
    await logAuditEvent({
      action: "auth.login_succeeded",
      actorUserId: user.id,
      actorRole: user.role,
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email },
      ...auditCtx,
    });

    return res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (e) {
    const code = e?.code;
    if (code === "P1001" || code === "P1017") {
      return res.status(503).json({ error: "database_unavailable" });
    }
    console.error(JSON.stringify({ level: "error", msg: "auth.login_failed", error: e?.message, code }));
    return res.status(500).json({ error: "login_failed" });
  }
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: "missing_refresh_token" });
  try {
    const payload = verifyRefreshToken(token);
    const row = await prisma.refreshToken.findFirst({
      where: { tokenHash: sha256(token), revokedAt: null },
    });
    if (!row) return res.status(401).json({ error: "invalid_refresh_token" });
    if (row.expiresAt.getTime() < Date.now()) return res.status(401).json({ error: "expired_refresh_token" });
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: "invalid_refresh_token" });
    const accessToken = signAccessToken(user);
    return res.json({
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, isEmailVerified: user.isEmailVerified },
    });
  } catch {
    return res.status(401).json({ error: "invalid_refresh_token" });
  }
});

router.post("/logout", async (req, res) => {
  const auditCtx = requestAuditContext(req);
  const token = req.cookies?.refresh_token;
  if (token) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await logAuditEvent({
    action: "auth.logout",
    targetType: "session",
    metadata: { hadRefreshToken: Boolean(token) },
    ...auditCtx,
  });
  res.clearCookie("refresh_token", { path: "/api/auth" });
  return res.json({ ok: true });
});

router.post("/request-password-reset", validate(requestResetSchema), async (req, res) => {
  const { email } = req.validatedBody;
  const auditCtx = requestAuditContext(req);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return res.json({ ok: true });
  const resetToken = randomToken(24);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: sha256(resetToken),
      passwordResetExpiresAt: new Date(Date.now() + 1000 * 60 * 30),
    },
  });
  await sendTransactionalEmail({
    to: user.email,
    template: "password_reset",
    idempotencyKey: `pwd_reset_${user.id}_${Date.now()}`,
    subject: "Password reset",
    html: `<p>Reset your password:</p><p><a href="${env.appUrl}/reset-password?token=${resetToken}">Set new password</a></p>`,
  });
  await logAuditEvent({
    action: "auth.password_reset_requested",
    actorUserId: user.id,
    actorRole: user.role,
    targetType: "user",
    targetId: user.id,
    metadata: { email: user.email },
    ...auditCtx,
  });
  return res.json({ ok: true });
});

router.post("/reset-password", validate(resetPasswordSchema), async (req, res) => {
  const { token, newPassword } = req.validatedBody;
  const user = await prisma.user.findFirst({
    where: { passwordResetToken: sha256(token) },
  });
  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
    return res.status(400).json({ error: "invalid_or_expired_token" });
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    },
  });
  return res.json({ ok: true });
});

export { router as authRouter };
