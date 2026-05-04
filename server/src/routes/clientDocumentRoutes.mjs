import express from "express";
import multer from "multer";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, sep } from "node:path";
import { prisma } from "../db/client.mjs";
import { requireAuth, requireRole } from "../middleware/auth.mjs";
import { absoluteStoragePath, ensureClientDocumentsDir, safeStorageRelativePath } from "../services/clientDocumentPaths.mjs";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

const router = express.Router();
router.use(requireAuth);
const PROJECT_ASSET_TYPES = new Set([
  "requirements",
  "branding",
  "logos",
  "brand_voice",
  "logs",
  "catalog",
]);

function normalizeProjectAssetType(value) {
  const v = String(value ?? "").trim();
  return PROJECT_ASSET_TYPES.has(v) ? v : null;
}

router.get("/", async (req, res) => {
  const rows = await prisma.clientDocument.findMany({
    where: { userId: req.auth.userId },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      category: true,
      title: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
  return res.json(rows);
});

router.get("/:id/download", async (req, res) => {
  const doc = await prisma.clientDocument.findFirst({
    where: { id: req.params.id, userId: req.auth.userId },
  });
  if (!doc) return res.status(404).json({ error: "not_found" });
  const abs = absoluteStoragePath(doc.storagePath);
  try {
    await access(abs);
  } catch {
    return res.status(404).json({ error: "file_missing" });
  }
  const buf = await readFile(abs);
  res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  return res.send(buf);
});

router.get("/projects/:projectId/assets", async (req, res) => {
  const projectId = String(req.params.projectId ?? "").trim();
  if (!projectId) return res.status(400).json({ error: "project_id_required" });
  const rows = await prisma.clientDocument.findMany({
    where: {
      userId: req.auth.userId,
      category: "Project Asset",
      title: { startsWith: `${projectId}:` },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
  const items = rows
    .map((row) => {
      const [, type = ""] = String(row.title || "").split(":");
      if (!PROJECT_ASSET_TYPES.has(type)) return null;
      return {
        id: row.id,
        type,
        fileName: row.fileName,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        uploadedAt: row.createdAt,
      };
    })
    .filter(Boolean);
  return res.json(items);
});

router.post("/projects/:projectId/assets/:type", upload.single("file"), async (req, res) => {
  const projectId = String(req.params.projectId ?? "").trim();
  const type = normalizeProjectAssetType(req.params.type);
  const file = req.file;
  if (!projectId) return res.status(400).json({ error: "project_id_required" });
  if (!type) return res.status(400).json({ error: "invalid_asset_type" });
  if (!file?.buffer?.length) return res.status(400).json({ error: "file_required" });

  await ensureClientDocumentsDir();
  const title = `${projectId}:${type}`;
  const existing = await prisma.clientDocument.findFirst({
    where: {
      userId: req.auth.userId,
      category: "Project Asset",
      title,
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    try {
      const fs = await import("node:fs/promises");
      await fs.unlink(absoluteStoragePath(existing.storagePath));
    } catch {
      /* ignore missing file */
    }
    await prisma.clientDocument.delete({ where: { id: existing.id } });
  }

  const doc = await prisma.clientDocument.create({
    data: {
      userId: req.auth.userId,
      category: "Project Asset",
      title,
      fileName: file.originalname || "upload",
      mimeType: file.mimetype || "application/octet-stream",
      sizeBytes: file.size,
      storagePath: "_pending_",
    },
  });
  const rel = safeStorageRelativePath(req.auth.userId, doc.id, file.originalname || "upload");
  const relPosix = rel.split(sep).join("/");
  const abs = absoluteStoragePath(relPosix);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, file.buffer);
  const updated = await prisma.clientDocument.update({
    where: { id: doc.id },
    data: { storagePath: relPosix, sizeBytes: file.size },
  });
  return res.status(201).json({
    id: updated.id,
    type,
    fileName: updated.fileName,
    mimeType: updated.mimeType,
    sizeBytes: updated.sizeBytes,
    uploadedAt: updated.createdAt,
  });
});

router.get("/projects/:projectId/assets/:type/download", async (req, res) => {
  const projectId = String(req.params.projectId ?? "").trim();
  const type = normalizeProjectAssetType(req.params.type);
  if (!projectId) return res.status(400).json({ error: "project_id_required" });
  if (!type) return res.status(400).json({ error: "invalid_asset_type" });
  const title = `${projectId}:${type}`;
  const doc = await prisma.clientDocument.findFirst({
    where: {
      userId: req.auth.userId,
      category: "Project Asset",
      title,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!doc) return res.status(404).json({ error: "not_found" });
  const abs = absoluteStoragePath(doc.storagePath);
  try {
    await access(abs);
  } catch {
    return res.status(404).json({ error: "file_missing" });
  }
  const buf = await readFile(abs);
  res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  return res.send(buf);
});

router.delete("/projects/:projectId/assets/:type", async (req, res) => {
  const projectId = String(req.params.projectId ?? "").trim();
  const type = normalizeProjectAssetType(req.params.type);
  if (!projectId) return res.status(400).json({ error: "project_id_required" });
  if (!type) return res.status(400).json({ error: "invalid_asset_type" });
  const title = `${projectId}:${type}`;
  const docs = await prisma.clientDocument.findMany({
    where: {
      userId: req.auth.userId,
      category: "Project Asset",
      title,
    },
    orderBy: { createdAt: "desc" },
  });
  if (docs.length === 0) return res.json({ ok: true, deleted: 0 });
  const ids = docs.map((d) => d.id);
  await prisma.clientDocument.deleteMany({ where: { id: { in: ids } } });
  const fs = await import("node:fs/promises");
  await Promise.all(
    docs.map(async (doc) => {
      try {
        await fs.unlink(absoluteStoragePath(doc.storagePath));
      } catch {
        /* ignore missing file */
      }
    }),
  );
  return res.json({ ok: true, deleted: docs.length });
});

/* ------------- Admin document uploads ------------- */
const adminDoc = express.Router();
adminDoc.use(requireAuth, requireRole("admin"));

adminDoc.get("/users/:userId/documents", async (req, res) => {
  const rows = await prisma.clientDocument.findMany({
    where: { userId: req.params.userId },
    orderBy: { createdAt: "desc" },
  });
  return res.json(rows);
});

adminDoc.post("/users/:userId/documents", upload.single("file"), async (req, res) => {
  const { userId } = req.params;
  const title = String(req.body?.title ?? "").trim() || "Document";
  const category = String(req.body?.category ?? "General").trim() || "General";
  const file = req.file;
  if (!file?.buffer?.length) return res.status(400).json({ error: "file_required" });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user_not_found" });

  await ensureClientDocumentsDir();
  const doc = await prisma.clientDocument.create({
    data: {
      userId,
      category,
      title,
      fileName: file.originalname || "upload",
      mimeType: file.mimetype || "application/octet-stream",
      sizeBytes: file.size,
      storagePath: "_pending_",
    },
  });

  const rel = safeStorageRelativePath(userId, doc.id, file.originalname || "upload");
  const relPosix = rel.split(sep).join("/");
  const abs = absoluteStoragePath(relPosix);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, file.buffer);

  const updated = await prisma.clientDocument.update({
    where: { id: doc.id },
    data: { storagePath: relPosix, sizeBytes: file.size },
  });
  return res.status(201).json(updated);
});

adminDoc.delete("/documents/:id", async (req, res) => {
  const doc = await prisma.clientDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: "not_found" });
  await prisma.clientDocument.delete({ where: { id: doc.id } });
  try {
    const fs = await import("node:fs/promises");
    await fs.unlink(absoluteStoragePath(doc.storagePath));
  } catch {
    /* ignore missing file */
  }
  return res.json({ ok: true });
});

export { router as clientDocumentRouter, adminDoc as adminClientDocumentRouter };
