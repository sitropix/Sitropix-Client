import {
  DOCUMENT_MAX_BYTES,
  PROJECT_ASSET_MAX_PER_TYPE,
  PROJECT_ASSET_MAX_PER_TYPE_ONBOARDING,
  SUPPORT_TICKET_MAX_ATTACHMENTS,
} from "../constants/documentLimits.mjs";

/**
 * @param {Array<{ size?: number; originalname?: string }>} files
 * @param {{ maxCount: number; maxBytes?: number }} opts
 */
export function validateUploadedFiles(files, opts) {
  const maxBytes = opts.maxBytes ?? DOCUMENT_MAX_BYTES;
  const list = Array.isArray(files) ? files : [];
  if (list.length > opts.maxCount) {
    return {
      ok: false,
      status: 400,
      error: "too_many_files",
      message: `You can attach at most ${opts.maxCount} file${opts.maxCount === 1 ? "" : "s"}.`,
      maxCount: opts.maxCount,
    };
  }
  for (const file of list) {
    const size = file?.size ?? 0;
    if (size > maxBytes) {
      const name = file?.originalname || "file";
      return {
        ok: false,
        status: 400,
        error: "file_too_large",
        message: `"${name}" exceeds the ${Math.round(maxBytes / (1024 * 1024))}MB limit.`,
        maxBytes,
      };
    }
  }
  return { ok: true };
}

export function validateSupportTicketAttachments(files) {
  return validateUploadedFiles(files, {
    maxCount: SUPPORT_TICKET_MAX_ATTACHMENTS,
    maxBytes: DOCUMENT_MAX_BYTES,
  });
}

export function validateProjectAssetUpload(file) {
  return validateUploadedFiles(file ? [file] : [], {
    maxCount: 1,
    maxBytes: DOCUMENT_MAX_BYTES,
  });
}

export {
  SUPPORT_TICKET_MAX_ATTACHMENTS,
  PROJECT_ASSET_MAX_PER_TYPE,
  PROJECT_ASSET_MAX_PER_TYPE_ONBOARDING,
  DOCUMENT_MAX_BYTES,
};
