import { useEffect, useRef, type ReactNode } from "react";
import { SxButton } from "./Button";

export interface SxConfirmDialogProps {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SxConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: SxConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, loading]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/55 p-4 backdrop-blur-[2px]"
      onClick={() => !loading && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sx-confirm-title"
        className="w-full max-w-md overflow-hidden rounded-sx-xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-sx-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6">
          <h2
            id="sx-confirm-title"
            className="font-display text-sx-xl font-semibold text-[var(--text-primary)]"
          >
            {title}
          </h2>
          {body ? (
            <div className="mt-2 text-sx-sm leading-relaxed text-[var(--text-secondary)]">
              {body}
            </div>
          ) : null}
        </div>
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-6 py-4">
          <SxButton
            ref={cancelRef}
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </SxButton>
          <SxButton
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </SxButton>
        </div>
      </div>
    </div>
  );
}
