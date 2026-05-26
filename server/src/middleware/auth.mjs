import { prisma } from "../db/client.mjs";
import { verifyAccessToken } from "../utils/tokens.mjs";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "unauthorized" });
    const token = header.slice("Bearer ".length);
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ error: "unauthorized" });
    req.auth = { userId: user.id, role: user.role, email: user.email, name: user.name };
    return next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: "unauthorized" });
    const { role } = req.auth;
    const allowed = roles.includes(role) || (role === "master_admin" && roles.includes("admin"));
    if (!allowed) return res.status(403).json({ error: "forbidden" });
    return next();
  };
}

export function requireModuleAccess(moduleKey) {
  return async (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: "unauthorized" });
    const { role, userId } = req.auth;

    const forbiddenBody = {
      error: "module_forbidden",
      moduleKey,
      message: "Your account does not currently have access to this admin module.",
    };

    if (role === "master_admin" || role === "admin") return next();
    // Support staff: tickets is always allowed (legacy contract). All other modules go through the DB toggle.
    if (role === "support" && moduleKey === "tickets") return next();
    if (role === "user") return res.status(403).json({ error: "forbidden" });

    try {
      const row = await prisma.userModuleAccess.findUnique({
        where: { userId_moduleKey: { userId, moduleKey } },
      });
      if (!row || !row.enabled) return res.status(403).json(forbiddenBody);
      return next();
    } catch {
      return res.status(503).json({
        error: "module_access_unavailable",
        message: "Module access checks are temporarily unavailable.",
      });
    }
  };
}
