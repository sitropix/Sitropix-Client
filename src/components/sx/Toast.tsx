import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Variant = "success" | "info" | "warning" | "error";

interface ToastRecord {
  id: string;
  variant: Variant;
  title: string;
  description?: string;
  durationMs?: number;
}

interface SxToastApi {
  show: (input: Omit<ToastRecord, "id">) => string;
  success: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
}

const SxToastContext = createContext<SxToastApi | null>(null);

const variantStyles: Record<Variant, { border: string; icon: string; iconChar: string }> = {
  success: {
    border: "border-[var(--color-success-500)]",
    icon: "bg-[var(--color-success-500)]",
    iconChar: "✓",
  },
  info: {
    border: "border-[var(--color-info-500)]",
    icon: "bg-[var(--color-info-500)]",
    iconChar: "i",
  },
  warning: {
    border: "border-[var(--color-warning-500)]",
    icon: "bg-[var(--color-warning-500)]",
    iconChar: "!",
  },
  error: {
    border: "border-[var(--color-danger-500)]",
    icon: "bg-[var(--color-danger-500)]",
    iconChar: "×",
  },
};

const defaultDuration: Record<Variant, number> = {
  success: 6000,
  info: 6000,
  warning: 0,
  error: 0,
};

export function SxToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastRecord[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    const t = timers.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: Omit<ToastRecord, "id">) => {
      const id = Math.random().toString(36).slice(2);
      const duration = input.durationMs ?? defaultDuration[input.variant];
      setItems((prev) => [...prev, { ...input, id }]);
      if (duration > 0) {
        const handle = window.setTimeout(() => dismiss(id), duration);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  const api = useMemo<SxToastApi>(
    () => ({
      show,
      success: (title, description) => show({ variant: "success", title, description }),
      info: (title, description) => show({ variant: "info", title, description }),
      warning: (title, description) => show({ variant: "warning", title, description }),
      error: (title, description) => show({ variant: "error", title, description }),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <SxToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:right-4 sm:left-auto sm:items-end"
      >
        {items.map((it) => {
          const v = variantStyles[it.variant];
          return (
            <div
              key={it.id}
              role="status"
              className={[
                "pointer-events-auto flex min-w-[300px] max-w-[420px] items-start gap-3 rounded-sx-md border",
                "bg-[var(--surface-card)] px-4 py-3 shadow-sx-md",
                v.border,
              ].join(" ")}
            >
              <span
                className={[
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-bold text-white",
                  v.icon,
                ].join(" ")}
                aria-hidden
              >
                {v.iconChar}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
                  {it.title}
                </div>
                {it.description ? (
                  <div className="mt-0.5 text-sx-xs text-[var(--text-secondary)]">
                    {it.description}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(it.id)}
                className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sx-sm text-[var(--text-tertiary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </SxToastContext.Provider>
  );
}

export function useSxToast(): SxToastApi {
  const ctx = useContext(SxToastContext);
  if (!ctx) {
    return {
      show: () => "",
      success: () => "",
      info: () => "",
      warning: () => "",
      error: () => "",
      dismiss: () => undefined,
    };
  }
  return ctx;
}
