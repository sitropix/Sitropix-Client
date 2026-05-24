import type { TicketAddonRef, TicketEditTypeRef } from "@/types/support";

/** Light-theme variant for customer My requests list. */
export function TicketLinkedMetaLight({
  editType,
  addon,
}: {
  editType?: TicketEditTypeRef | null;
  addon?: TicketAddonRef | null;
}) {
  if (!editType && !addon) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {editType ? (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-950">
          Edit: {editType.label}
        </span>
      ) : null}
      {addon ? (
        <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900">
          Add-on: {addon.label}
        </span>
      ) : null}
    </div>
  );
}
