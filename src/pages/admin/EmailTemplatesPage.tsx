import { useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { fetchAdminEmailTemplates, saveAdminEmailTemplate, type EmailTemplateRow as TemplateRow } from "@/services/subscriptionsApi";

const PREVIEW_DATA: Record<string, string> = {
  name: "John",
  email: "john@example.com",
  signupUrl: "https://app.sitropix.com/signup?invite=sample",
  resetUrl: "https://app.sitropix.com/reset-password?token=sample",
  paymentUrl: "https://app.sitropix.com/subscription?prefillPlan=starter",
};

function renderTemplate(input: string) {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, token: string) => PREVIEW_DATA[token] ?? "");
}

export function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchAdminEmailTemplates()
      .then((rows) => {
        if (cancelled) return;
        setTemplates(rows);
        setSelectedId(rows[0]?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) setNotice("Could not load templates.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) ?? null, [templates, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setSubject(selected.subject);
    setHtml(selected.html);
  }, [selectedId, selected?.subject, selected?.html]);

  async function onSave() {
    if (!selected) return;
    try {
      const saved = await saveAdminEmailTemplate(selected.id, {
        name: selected.name,
        subject: subject.trim(),
        html,
      });
      const next = templates.map((row) => (row.id === selected.id ? { ...row, subject: saved.subject, html: saved.html } : row));
      setTemplates(next);
      setNotice("Template saved.");
      window.setTimeout(() => setNotice(null), 1500);
    } catch {
      setNotice("Failed to save template.");
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Admin" }, { label: "Email Templates" }]} />
      <header>
        <h1 className="text-3xl font-black tracking-tight text-white">Email Templates</h1>
        <p className="mt-1 text-sm text-neutral-400">Edit transactional templates and preview rendered output before saving.</p>
      </header>

      {notice ? <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</p> : null}

      <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[#24292E] bg-[#15191C] p-3">
          <p className="px-2 pb-2 text-xs uppercase tracking-widest text-neutral-500">Templates</p>
          <div className="space-y-1">
            {loading ? (
              <p className="px-2 py-2 text-xs text-neutral-500">Loading...</p>
            ) : templates.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  selectedId === row.id ? "bg-neutral-100 text-neutral-900" : "text-neutral-300 hover:bg-[#1C2126]"
                }`}
              >
                {row.name}
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-3 rounded-xl border border-[#24292E] bg-[#15191C] p-4">
          <label className="block text-xs uppercase tracking-widest text-neutral-500">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white"
          />
          <label className="block text-xs uppercase tracking-widest text-neutral-500">HTML</label>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-[#24292E] bg-[#1C2126] px-3 py-2 text-sm text-white"
          />
          <button type="button" onClick={onSave} className="rounded-lg bg-brand-lime px-4 py-2 text-sm font-semibold text-canvas">
            Save template
          </button>
        </div>

        <div className="rounded-xl border border-[#24292E] bg-[#15191C] p-4">
          <p className="text-xs uppercase tracking-widest text-neutral-500">Preview</p>
          <p className="mt-2 text-sm font-semibold text-white">{renderTemplate(subject || "")}</p>
          <div
            className="mt-3 rounded-lg border border-[#24292E] bg-[#1C2126] p-3 text-sm text-neutral-200"
            dangerouslySetInnerHTML={{ __html: renderTemplate(html || "") }}
          />
        </div>
      </section>
    </div>
  );
}
