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
