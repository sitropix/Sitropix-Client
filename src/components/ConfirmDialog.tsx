import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    return () => prev?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const confirmBtnClass =
    variant === "danger"
      ? "bg-rose-500 hover:bg-rose-600 text-white"
      : variant === "warning"
        ? "bg-amber-500 hover:bg-amber-600 text-canvas"
        : "bg-brand-lime hover:bg-brand-lime-dim text-canvas";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => !loading && onCancel()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-desc" : undefined}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-xl border border-[#24292E] bg-[#15191C] p-6 shadow-2xl duration-150"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-white">
          {title}
        </h2>
        {description && (
          <p id="confirm-dialog-desc" className="mt-2 text-sm text-neutral-400">
            {description}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${confirmBtnClass}`}
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface DeleteConfirmDialogProps {
  open: boolean;
  title: string;
  itemName: string;
  itemType?: string;
  details?: Array<{ label: string; value: string | number }>;
  confirmText?: string;
  loading?: boolean;
  onConfirm: (confirmValue: string) => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  open,
  title,
  itemName,
  itemType = "item",
  details,
  confirmText,
  loading = false,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (open) {
      setInputValue("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const canConfirm = confirmText ? inputValue.trim().toLowerCase() === confirmText.toLowerCase() : true;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => !loading && onCancel()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-xl border border-[#24292E] bg-[#15191C] p-6 shadow-2xl duration-150"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15">
            <svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              Are you sure you want to delete <span className="font-medium text-white">{itemName}</span>?
            </p>
          </div>
        </div>

        {details && details.length > 0 && (
          <div className="mt-4 rounded-lg border border-[#24292E] bg-[#1C2126] p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Data that will be deleted
            </p>
            <dl className="space-y-1">
              {details.map((d) => (
                <div key={d.label} className="flex justify-between text-sm">
                  <dt className="text-neutral-400">{d.label}</dt>
                  <dd className="font-medium text-white">{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <p className="mt-4 text-xs text-rose-300/90">This action cannot be undone.</p>

        {confirmText && (
          <div className="mt-4">
            <label className="text-xs text-neutral-400">
              Type <span className="font-mono text-white">{confirmText}</span> to confirm:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white outline-none focus:border-rose-500/50"
              placeholder={confirmText}
            />
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[#24292E] bg-[#1C2126] px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(inputValue.trim())}
            disabled={loading || !canConfirm}
            className="flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            Delete {itemType}
          </button>
        </div>
      </div>
    </div>
  );
}
