/** Fired after project list data may have changed (e.g. post-checkout) so shells can refetch with `force: true`. */
export const PROJECTS_LIST_INVALIDATE_EVENT = "sitropix:invalidate-projects";

export function dispatchProjectsListInvalidate(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PROJECTS_LIST_INVALIDATE_EVENT));
}
