import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { env } from "../config/env.mjs";

export function clientDocumentsRoot() {
  return resolve(process.cwd(), env.clientDocumentsDir);
}

export async function ensureClientDocumentsDir() {
  const root = clientDocumentsRoot();
  await mkdir(root, { recursive: true });
  return root;
}

export function safeStorageRelativePath(userId, documentId, originalName) {
  const base = originalName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
  return join(userId, `${documentId}_${base}`);
}

export function absoluteStoragePath(relativePath) {
  const parts = String(relativePath).split("/").filter(Boolean);
  return join(clientDocumentsRoot(), ...parts);
}
