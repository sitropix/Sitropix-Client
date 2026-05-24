import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  /** Backdrop + positioning */
  className?: string;
  zIndexClass?: string;
};

const DEFAULT_BACKDROP =
  "fixed inset-0 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4";

export function PortalOverlay({
  open,
  onClose,
  children,
  className = DEFAULT_BACKDROP,
  zIndexClass = "z-[200]",
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`${className} ${zIndexClass}`}
      role="presentation"
      onClick={onClose}
    >
      {children}
    </div>,
    document.body,
  );
}
