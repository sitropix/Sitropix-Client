import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminEmailTemplates,
  saveAdminEmailTemplate,
  type EmailTemplateRow,
} from "@/services/subscriptionsApi";
import { SxButton } from "@/components/sx/Button";
import { SxInput, SxTextarea } from "@/components/sx/Input";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function EmailTemplatesPage() {
  const toast = useSxToast();
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const rows = await fetchAdminEmailTemplates();
      setTemplates(rows);
      if (!selectedId && rows.length > 0) {
        const first = rows[0];
        setSelectedId(first.id);
        setName(first.name);
        setSubject(first.subject);
        setHtml(first.html);
      }
    } catch {
      toast.error("Couldn't load templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  function openTemplate(t: EmailTemplateRow) {
    setSelectedId(t.id);
    setName(t.name);
    setSubject(t.subject);
    setHtml(t.html);
  }

  async function onSave() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const next = await saveAdminEmailTemplate(selectedId, {
        name: name.trim(),
        subject: subject.trim(),
        html,
      });
      setTemplates((prev) =>
        prev.map((t) => (t.id === next.id ? next : t)),
      );
      toast.success("Template saved.");
    } catch (err) {
      toast.error(
        "Couldn't save template.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  }

  function renderPreview(text: string): string {
    return text
      .replace(/\{\{\s*firstName\s*\}\}/g, "Alex")
      .replace(/\{\{\s*lastName\s*\}\}/g, "Lee")
      .replace(/\{\{\s*name\s*\}\}/g, "Alex Lee")
      .replace(/\{\{\s*email\s*\}\}/g, "alex@example.com")
      .replace(/\{\{\s*ticketId\s*\}\}/g, "TKT-1234")
      .replace(/\{\{\s*planName\s*\}\}/g, "Growth")
      .replace(/\{\{\s*resetLink\s*\}\}/g, "https://app.sitropix.com/reset?token=…")
      .replace(/\{\{\s*verifyLink\s*\}\}/g, "https://app.sitropix.com/verify?token=…");
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Settings
        </p>
        <h1 className="mt-1.5 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Email templates
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          Edit the body of system emails. Use{" "}
          <code className="rounded-sx-xs bg-[var(--surface-sunken)] px-1 font-mono text-sx-xs">
            {"{{firstName}}"}
          </code>{" "}
          style placeholders.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <SxPanel title="Templates" padded={false}>
          {loading ? (
            <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
          ) : templates.length === 0 ? (
            <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">
              No templates configured.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {templates.map((t) => {
                const active = t.id === selectedId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openTemplate(t)}
                      className={[
                        "block w-full px-4 py-3 text-left transition-colors",
                        active
                          ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                          : "text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]",
                      ].join(" ")}
                    >
                      <p className="truncate font-ui text-sx-sm font-medium">
                        {t.name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-sx-2xs text-[var(--text-tertiary)]">
                        {t.id} · {formatDate(t.updatedAt)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SxPanel>

        <div className="flex flex-col gap-4">
          {selected ? (
            <>
              <SxPanel title="Edit">
                <div className="flex flex-col gap-3">
                  <SxInput
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <SxInput
                    label="Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                  <SxTextarea
                    label="HTML body"
                    rows={14}
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    helpText="Plain HTML. Placeholder substitution happens server-side."
                  />
                  <div>
                    <SxButton onClick={() => void onSave()} loading={saving}>
                      Save template
                    </SxButton>
                  </div>
                </div>
              </SxPanel>

              <SxPanel title="Preview (sample data)">
                <p className="font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
                  {renderPreview(subject)}
                </p>
                <div
                  className="mt-3 max-h-[480px] overflow-auto rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4 text-sx-sm text-[var(--text-primary)]"
                  dangerouslySetInnerHTML={{ __html: renderPreview(html) }}
                />
              </SxPanel>
            </>
          ) : (
            <SxPanel>
              <p className="text-sx-sm text-[var(--text-tertiary)]">
                Pick a template on the left to edit it.
              </p>
            </SxPanel>
          )}
        </div>
      </div>
    </div>
  );
}
