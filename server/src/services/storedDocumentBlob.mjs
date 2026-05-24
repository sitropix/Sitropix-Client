import { access, readFile } from "node:fs/promises";
import { absoluteStoragePath } from "./clientDocumentPaths.mjs";
import { absoluteTicketAttachmentPath } from "./ticketAttachmentPaths.mjs";

/** @param {Buffer} buffer */
export function blobStorageFields(buffer) {
  return {
    fileData: buffer,
    storagePath: "",
    sizeBytes: buffer.length,
  };
}

/**
 * @param {{ fileData?: Buffer | Uint8Array | null; storagePath?: string | null }} record
 * @returns {Promise<Buffer>}
 */
export async function readClientDocumentBytes(record) {
  if (record.fileData?.length) {
    return Buffer.from(record.fileData);
  }
  const path = String(record.storagePath ?? "").trim();
  if (!path || path === "_pending_") {
    const err = new Error("file_missing");
    err.code = "file_missing";
    throw err;
  }
  const abs = absoluteStoragePath(path);
  try {
    await access(abs);
  } catch {
    const err = new Error("file_missing");
    err.code = "file_missing";
    throw err;
  }
  return readFile(abs);
}

/**
 * @param {{ fileData?: Buffer | Uint8Array | null; storagePath?: string | null }} record
 * @returns {Promise<Buffer>}
 */
export async function readTicketAttachmentBytes(record) {
  if (record.fileData?.length) {
    return Buffer.from(record.fileData);
  }
  const path = String(record.storagePath ?? "").trim();
  if (!path || path === "_pending_") {
    const err = new Error("file_missing");
    err.code = "file_missing";
    throw err;
  }
  const abs = absoluteTicketAttachmentPath(path);
  try {
    await access(abs);
  } catch {
    const err = new Error("file_missing");
    err.code = "file_missing";
    throw err;
  }
  return readFile(abs);
}
