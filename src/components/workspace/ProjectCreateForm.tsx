import { portal } from "@/components/portal/portalStyles";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { useToast } from "@/components/Toast";
import { dispatchProjectsListInvalidate } from "@/services/projectsInvalidate";
import { createProject } from "@/services/projectsStore";
import type { ProjectRecord } from "@/types/project";
import { useId, useRef, useState } from "react";

type Props = {
  /** @deprecated Prefer auth context; only used when provided for tests. */
  userId?: string;
  layout?: "inline" | "stacked";
  onCreated?: (project: ProjectRecord) => void;
  autoFocusName?: boolean;
};

export function ProjectCreateForm({
  userId: userIdProp,
  layout = "inline",
  onCreated,
  autoFocusName = false,
}: Props) {
  const { user, loading: authLoading } = useAuth();
  const { portal: portalUser } = useUser();
  const { showError, showSuccess } = useToast();
  const userId = userIdProp ?? user?.id ?? portalUser?.user?.id ?? null;
  const nameInputId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  async function runCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter a project name, then click New Project.");
      nameInputRef.current?.focus();
      return;
    }
    if (!userId) {
      showError("Your session is still loading. Wait a moment and try again.");
      return;
    }
    if (busy) return;
    setNameError(null);
    setBusy(true);
    try {
      const created = await createProject(userId, trimmed, description);
      setName("");
      setDescription("");
      dispatchProjectsListInvalidate();
      showSuccess(`Project "${created.name}" created.`);
      onCreated?.(created);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not create project.");
    } finally {
      setBusy(false);
    }
  }

  const gridClass =
    layout === "stacked"
      ? "grid gap-2"
      : "grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]";

  const accountReady = Boolean(userId) && !authLoading;

  return (
    <form
      id="new-project-form"
      className={gridClass + " relative z-0"}
      onSubmit={(e) => {
        e.preventDefault();
        void runCreate();
      }}
    >
      <div className={layout === "stacked" ? "space-y-1" : "min-w-0"}>
        <label htmlFor={nameInputId} className="sr-only">
          Project name
        </label>
        <input
          ref={nameInputRef}
          id={nameInputId}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
          placeholder="Project name (required)"
          disabled={busy || !accountReady}
          autoFocus={autoFocusName}
          className={portal.input}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${nameInputId}-error` : undefined}
        />
      </div>
      <div className={layout === "stacked" ? "space-y-1" : "min-w-0"}>
        <label htmlFor={`${nameInputId}-desc`} className="sr-only">
          Short summary
        </label>
        <input
          id={`${nameInputId}-desc`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short summary (optional)"
          disabled={busy || !accountReady}
          className={portal.input}
        />
      </div>
      <button
        type="submit"
        disabled={busy || !accountReady}
        aria-busy={busy}
        className={
          portal.btnPrimary +
          (layout === "stacked" ? " w-full !py-3" : " shrink-0") +
          " pointer-events-auto"
        }
      >
        {busy ? "Creating…" : authLoading || !userId ? "Loading…" : "+ New Project"}
      </button>
      {!accountReady && !authLoading ? (
        <p
          className={
            (layout === "stacked" ? "" : "sm:col-span-3 ") +
            "font-body-sm text-body-sm text-rose-700"
          }
        >
          Sign in to create a project.
        </p>
      ) : null}
      {nameError ? (
        <p
          id={`${nameInputId}-error`}
          className={
            (layout === "stacked" ? "" : "sm:col-span-3 ") +
            "font-body-sm text-body-sm text-rose-700"
          }
          role="alert"
        >
          {nameError}
        </p>
      ) : null}
    </form>
  );
}
