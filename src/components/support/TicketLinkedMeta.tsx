import type { TicketAddonRef, TicketEditTypeRef } from "@/types/support";

export function TicketLinkedMeta({
  editType,
  addon,
  creditsCharged,
  className = "",
}: {
  editType?: TicketEditTypeRef | null;
  addon?: TicketAddonRef | null;
  creditsCharged?: number;
  className?: string;
}) {
  if (!editType && !addon && !(creditsCharged && creditsCharged > 0)) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      {editType ? (
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-100">
          Edit: {editType.label}
        </span>
      ) : null}
      {addon ? (
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-100">
          Add-on: {addon.label}
        </span>
      ) : null}
      {(creditsCharged ?? 0) > 0 ? (
        <span className="text-[11px] text-ink-muted">
          {creditsCharged} edit credit{creditsCharged === 1 ? "" : "s"} reserved
        </span>
      ) : null}
    </div>
  );
}
