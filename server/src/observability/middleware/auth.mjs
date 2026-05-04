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
    if (!roles.includes(req.auth.role)) return res.status(403).json({ error: "forbidden" });
    return next();
  };
}

export function requireModuleAccess(moduleKey) {
  return async (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: "unauthorized" });
    if (req.auth.role === "master_admin") return next();
    if (req.auth.role === "user") return res.status(403).json({ error: "forbidden" });
    const row = await prisma.userModuleAccess.findUnique({
      where: { userId_moduleKey: { userId: req.auth.userId, moduleKey } },
    });
    if (!row) {
      return res.status(403).json({
        error: "module_forbidden",
        moduleKey,
        message: "Your account does not currently have access to this admin module.",
      });
    }
    if (!row.enabled) {
      return res.status(403).json({
        error: "module_forbidden",
        moduleKey,
        message: "Your account does not currently have access to this admin module.",
      });
    }
    return next();
  };
}
