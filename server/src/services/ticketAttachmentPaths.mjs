import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { clientDocumentsRoot } from "./clientDocumentPaths.mjs";

export function ticketAttachmentsRoot() {
  return join(clientDocumentsRoot(), "ticket-attachments");
}

export async function ensureTicketAttachmentsDir() {
  const root = ticketAttachmentsRoot();
  await mkdir(root, { recursive: true });
  return root;
}

export function safeTicketAttachmentRelativePath(ticketId, attachmentId, originalName) {
  const base = String(originalName || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120) || "file";
  return `${ticketId}/${attachmentId}_${base}`;
}

export function absoluteTicketAttachmentPath(relativePath) {
  const parts = String(relativePath).split("/").filter(Boolean);
  return join(ticketAttachmentsRoot(), ...parts);
}
