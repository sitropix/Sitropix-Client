export const DOCUMENT_MAX_BYTES = 2 * 1024 * 1024;
export const SUPPORT_TICKET_MAX_ATTACHMENTS = 5;
/** One file per category while completing project setup. */
export const PROJECT_ASSET_MAX_PER_TYPE_ONBOARDING = 1;

/** Multiple files per category after setup (project dashboard). */
export const PROJECT_ASSET_MAX_PER_TYPE = 10;

export function documentMaxSizeLabelMb(): string {
  return `${DOCUMENT_MAX_BYTES / (1024 * 1024)}MB`;
}

export function filterFilesWithinLimits(
  incoming: File[],
  existing: File[],
  opts: { maxCount: number; maxBytes?: number },
): { accepted: File[]; rejected: string[] } {
  const maxBytes = opts.maxBytes ?? DOCUMENT_MAX_BYTES;
  const maxCount = opts.maxCount;
  const accepted: File[] = [...existing];
  const rejected: string[] = [];

  for (const file of incoming) {
    if (accepted.length >= maxCount) {
      rejected.push(`Only ${maxCount} file${maxCount === 1 ? "" : "s"} allowed.`);
      break;
    }
    if (file.size > maxBytes) {
      rejected.push(`"${file.name}" exceeds the ${documentMaxSizeLabelMb()} limit.`);
      continue;
    }
    accepted.push(file);
  }

  return { accepted: accepted.slice(0, maxCount), rejected };
}
