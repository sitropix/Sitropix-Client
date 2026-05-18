import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
};

export function AddonNotAvailableModal({ open, onClose, projectId }: Props) {
  const navigate = useNavigate();
  const upgradeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    upgradeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal
      aria-labelledby="addon-not-available-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#2A3037] bg-[#15191C] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="addon-not-available-title" className="text-lg font-bold text-white">
          Add-on not available
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          This add-on is not available for you right now. In order to have this, please upgrade.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            Close
          </button>
          <button
            ref={upgradeRef}
            type="button"
            onClick={() => {
              onClose();
              navigate(`/projects/${projectId}/subscription`);
            }}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-canvas hover:bg-zinc-200"
          >
            Upgrade plan
          </button>
        </div>
      </div>
    </div>
  );
}
