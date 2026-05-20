import express from "express";
import multer from "multer";
import { prisma } from "../db/client.mjs";
import { requireAuth, requireRole } from "../middleware/auth.mjs";
import {
  DOCUMENT_MAX_BYTES,
  PROJECT_ASSET_MAX_PER_TYPE,
  PROJECT_ASSET_MAX_PER_TYPE_ONBOARDING,
} from "../constants/documentLimits.mjs";
import {
  blobStorageFields,
  readClientDocumentBytes,
} from "../services/storedDocumentBlob.mjs";
import {
  validateProjectAssetUpload,
  validateUploadedFiles,
} from "../services/uploadValidation.mjs";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_MAX_BYTES },
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

function projectAssetTitle(projectId, type) {
  return `${projectId}:${type}`;
}

async function countProjectAssetsForType(userId, projectId, type) {
  return prisma.clientDocument.count({
    where: {
      userId,
      category: "Project Asset",
      title: projectAssetTitle(projectId, type),
    },
  });
}

function isOnboardingAssetUpload(req) {
  const raw = req.query?.onboarding ?? req.body?.onboarding;
  return raw === "1" || raw === "true" || raw === true;
}

async function deleteProjectAssetsForType(userId, projectId, type) {
  const title = projectAssetTitle(projectId, type);
  const docs = await prisma.clientDocument.findMany({
    where: { userId, category: "Project Asset", title },
    select: { id: true },
  });
  if (docs.length === 0) return 0;
  await prisma.clientDocument.deleteMany({
    where: { id: { in: docs.map((d) => d.id) } },
  });
  return docs.length;
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
  let buf;
  try {
    buf = await readClientDocumentBytes(doc);
  } catch (e) {
    if (e?.code === "file_missing") return res.status(404).json({ error: "file_missing" });
    throw e;
  }
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

  const fileCheck = validateProjectAssetUpload(file);
  if (!fileCheck.ok) {
    return res.status(fileCheck.status).json({
      error: fileCheck.error,
      message: fileCheck.message,
      maxBytes: fileCheck.maxBytes,
    });
  }

  const onboarding = isOnboardingAssetUpload(req);
  const maxPerType = onboarding
    ? PROJECT_ASSET_MAX_PER_TYPE_ONBOARDING
    : PROJECT_ASSET_MAX_PER_TYPE;

  const existingCount = await countProjectAssetsForType(req.auth.userId, projectId, type);
  if (onboarding) {
    if (existingCount >= maxPerType) {
      await deleteProjectAssetsForType(req.auth.userId, projectId, type);
    }
  } else if (existingCount >= maxPerType) {
    return res.status(400).json({
      error: "too_many_files",
      message: `You can upload at most ${maxPerType} files for this category.`,
      maxCount: maxPerType,
    });
  }

  const title = projectAssetTitle(projectId, type);
  const doc = await prisma.clientDocument.create({
    data: {
      userId: req.auth.userId,
      category: "Project Asset",
      title,
      fileName: file.originalname || "upload",
      mimeType: file.mimetype || "application/octet-stream",
      ...blobStorageFields(file.buffer),
    },
  });
  return res.status(201).json({
    id: doc.id,
    type,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedAt: doc.createdAt,
  });
});

router.get("/projects/:projectId/assets/:documentId/download", async (req, res) => {
  const projectId = String(req.params.projectId ?? "").trim();
  const documentId = String(req.params.documentId ?? "").trim();
  if (!projectId) return res.status(400).json({ error: "project_id_required" });
  if (!documentId) return res.status(400).json({ error: "document_id_required" });

  const doc = await prisma.clientDocument.findFirst({
    where: {
      id: documentId,
      userId: req.auth.userId,
      category: "Project Asset",
      title: { startsWith: `${projectId}:` },
    },
  });
  if (!doc) return res.status(404).json({ error: "not_found" });

  let buf;
  try {
    buf = await readClientDocumentBytes(doc);
  } catch (e) {
    if (e?.code === "file_missing") return res.status(404).json({ error: "file_missing" });
    throw e;
  }
  res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
  return res.send(buf);
});

router.delete("/projects/:projectId/assets/:documentId", async (req, res) => {
  const projectId = String(req.params.projectId ?? "").trim();
  const documentId = String(req.params.documentId ?? "").trim();
  if (!projectId) return res.status(400).json({ error: "project_id_required" });
  if (!documentId) return res.status(400).json({ error: "document_id_required" });

  const doc = await prisma.clientDocument.findFirst({
    where: {
      id: documentId,
      userId: req.auth.userId,
      category: "Project Asset",
      title: { startsWith: `${projectId}:` },
    },
  });
  if (!doc) return res.status(404).json({ error: "not_found" });
  await prisma.clientDocument.delete({ where: { id: doc.id } });
  return res.json({ ok: true, deleted: 1 });
});

/* ------------- Admin document uploads ------------- */
const adminDoc = express.Router();
adminDoc.use(requireAuth, requireRole("admin", "master_admin"));

adminDoc.get("/users/:userId/documents", async (req, res) => {
  const rows = await prisma.clientDocument.findMany({
    where: { userId: req.params.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
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

adminDoc.post("/users/:userId/documents", upload.single("file"), async (req, res) => {
  const { userId } = req.params;
  const title = String(req.body?.title ?? "").trim() || "Document";
  const category = String(req.body?.category ?? "General").trim() || "General";
  const file = req.file;
  if (!file?.buffer?.length) return res.status(400).json({ error: "file_required" });

  const fileCheck = validateUploadedFiles([file], { maxCount: 1 });
  if (!fileCheck.ok) {
    return res.status(fileCheck.status).json({
      error: fileCheck.error,
      message: fileCheck.message,
      maxBytes: fileCheck.maxBytes,
    });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "user_not_found" });

  const doc = await prisma.clientDocument.create({
    data: {
      userId,
      category,
      title,
      fileName: file.originalname || "upload",
      mimeType: file.mimetype || "application/octet-stream",
      ...blobStorageFields(file.buffer),
    },
  });
  return res.status(201).json({
    id: doc.id,
    userId: doc.userId,
    category: doc.category,
    title: doc.title,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    createdAt: doc.createdAt,
  });
});

adminDoc.delete("/documents/:id", async (req, res) => {
  const doc = await prisma.clientDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: "not_found" });
  await prisma.clientDocument.delete({ where: { id: doc.id } });
  return res.json({ ok: true });
});

export { router as clientDocumentRouter, adminDoc as adminClientDocumentRouter };
