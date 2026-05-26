import type { ProjectNextAction } from "@/types/projectWorkflow";

/** Rewrite the customer-shaped next-action into a staff-shaped one. */
function reframeForStaff(a: ProjectNextAction, staffUnread: number): ProjectNextAction {
  switch (a.kind) {
    case "fill_brief":
      return { ...a, title: "Customer is filling in the brief", body: "They need to add brand voice + description before you start.", cta: null, href: null };
    case "upload_assets":
      return { ...a, title: "Customer is uploading assets", body: "They still need to upload logo + brand files.", cta: null, href: null };
    case "wait":
      return staffUnread > 0
        ? { ...a, kind: "reply_chat", title: `${staffUnread} unread customer message${staffUnread === 1 ? "" : "s"}`, body: "Open chat and reply.", cta: "Open chat", href: "#project-chat" }
        : { ...a, title: "Your turn to build", body: "Nothing blocking — keep working.", cta: null, href: null };
    case "reply_chat":
      // Customer-facing was "designer is waiting" — for staff, flip it.
      return { ...a, title: "You marked this as waiting on the customer", body: "They'll see the prompt to reply. Move status back to In progress once they do.", cta: null, href: null };
    case "approve_design":
      return { ...a, title: "Customer is reviewing your design", body: "They'll click Approve or send revisions in chat.", cta: null, href: null };
    case "approve_launch":
      return { ...a, title: "Customer is approving launch", body: "Set the live URL in Designer Controls when they sign off.", cta: null, href: null };
    case "live":
      return { ...a, title: "Site is live", body: a.body, cta: a.cta, href: a.href };
    default:
      return a;
  }
}

export function NextActionCard(props: {
  nextAction: ProjectNextAction | null | undefined;
  viewerIsStaff?: boolean;
  staffUnreadCount?: number;
}) {
  const raw = props.nextAction;
  if (!raw) return null;
  const a = props.viewerIsStaff ? reframeForStaff(raw, props.staffUnreadCount ?? 0) : raw;
  const isWait = a.kind === "wait" || a.kind === "live";
  const accent = isWait
    ? "border-[var(--border-subtle)] bg-[var(--surface-sunken)]"
    : "border-[var(--color-brand-500)]/40 bg-[var(--color-brand-50)]";
  return (
    <section
      className={`flex flex-col gap-3 rounded-sx-lg border-2 p-5 sm:flex-row sm:items-center sm:justify-between ${accent}`}
      aria-label="Next action"
    >
      <div className="min-w-0">
        <p className="font-mono text-sx-2xs uppercase tracking-wider text-[var(--text-tertiary)]">
          {props.viewerIsStaff ? "What's happening" : "Next action"}
        </p>
        <h2 className="mt-1 font-display text-sx-lg font-semibold text-[var(--text-primary)]">{a.title}</h2>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">{a.body}</p>
      </div>
      {a.cta && a.href ? (
        <a
          href={a.href}
          {...(a.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="inline-flex h-[44px] shrink-0 items-center justify-center rounded-sx-md bg-[var(--color-brand-500)] px-6 font-ui text-sx-sm font-semibold text-white hover:bg-[var(--color-brand-600)]"
        >
          {a.cta} →
        </a>
      ) : null}
    </section>
  );
}
