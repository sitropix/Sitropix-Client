import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useTickets } from "@/hooks/useTickets";

export function SubmitTicketPage() {
  const navigate = useNavigate();
  const { submitTicket } = useTickets();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subject.trim() || !description.trim()) {
      setError("Subject and details are required.");
      return;
    }
    setSubmitting(true);
    try {
      await submitTicket({ subject: subject.trim(), description: description.trim() });
      navigate("/requests");
    } catch {
      setError("Could not submit the ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Submit a ticket" }]} />
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Submit a ticket</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Lead with impact and reproduction steps — our routing engine assigns the right pod automatically.
        </p>
      </header>

      <form onSubmit={onSubmit} className="grid gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div>
          <label htmlFor="subject" className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Subject
          </label>
          <input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-lime/35 focus:ring-2 focus:ring-brand-lime/25"
            placeholder="e.g. Webhooks return 401 after key rotation"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="description" className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Details
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-brand-lime/35 focus:ring-2 focus:ring-brand-lime/25"
            placeholder="What you expected, what happened, timestamps, request IDs, and any screenshots."
          />
        </div>

        {error && <p className="text-sm text-rose-200">{error}</p>}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">
            By submitting, you agree we may access account metadata needed to resolve this request.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-full bg-brand-lime px-6 py-2.5 text-sm font-semibold text-canvas shadow-glow transition enabled:hover:scale-[1.02] enabled:hover:bg-brand-lime-dim disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Submit ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}
