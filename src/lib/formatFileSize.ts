/** Human-readable size: KB below 1 MiB, otherwise MB (one decimal). */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const mb = 1024 * 1024;
  if (bytes < mb) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / mb).toFixed(1)} MB`;
}
