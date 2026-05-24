import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createAdminForm,
  deleteAdminForm,
  fetchAdminFormDetail,
  fetchAdminFormEmbed,
  fetchAdminForms,
  patchAdminForm,
  replaceAdminFormFields,
} from "@/services/subscriptionsApi";
import type {
  FormDefinitionDetail,
  FormDefinitionListItem,
  FormEmbedPayload,
  FormFieldRow,
} from "@/types/subscription";
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxConfirmDialog } from "@/components/sx/ConfirmDialog";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxInput, SxSelect, SxTextarea } from "@/components/sx/Input";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

const FIELD_TYPES: FormFieldRow["type"][] = [
  "text",
  "email",
  "tel",
  "phone",
  "textarea",
  "select",
  "number",
  "url",
  "checkbox",
  "date",
  "hidden",
  "file",
];

function newFieldRow(order: number): FormFieldRow {
  return {
    key: `field_${order + 1}`,
    label: `Field ${order + 1}`,
    type: "text",
    required: false,
    fieldOrder: order,
  };
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function FormBuilderPage() {
  const toast = useSxToast();
  const [forms, setForms] = useState<FormDefinitionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FormDefinitionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [embed, setEmbed] = useState<FormEmbedPayload | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FormFieldRow[]>([]);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingFields, setSavingFields] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [creating, setCreating] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reloadList() {
    setLoading(true);
    try {
      const res = await fetchAdminForms();
      const rows = res.items;
      setForms(rows);
      if (!selectedId && rows.length > 0) {
        setSelectedId(rows[0].id);
      }
    } catch {
      toast.error("Couldn't load forms.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadList();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setEmbed(null);
      return;
    }
    setDetailLoading(true);
    void Promise.all([
      fetchAdminFormDetail(selectedId),
      fetchAdminFormEmbed(selectedId).catch(() => null),
    ])
      .then(([d, e]) => {
        setDetail(d);
        setName(d.name);
        setSlug(d.slug);
        setIsActive(d.isActive);
        setFields(
          [...d.fields].sort((a, b) => a.fieldOrder - b.fieldOrder),
        );
        setEmbed(e);
      })
      .catch(() => toast.error("Couldn't load form details."))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  function updateField(idx: number, patch: Partial<FormFieldRow>) {
    setFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    );
  }

  function moveField(idx: number, dir: -1 | 1) {
    setFields((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((f, i) => ({ ...f, fieldOrder: i }));
    });
  }

  function removeField(idx: number) {
    setFields((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((f, i) => ({ ...f, fieldOrder: i })),
    );
  }

  function addField() {
    setFields((prev) => [...prev, newFieldRow(prev.length)]);
  }

  async function saveMeta() {
    if (!selectedId) return;
    setSavingMeta(true);
    try {
      await patchAdminForm(selectedId, {
        name: name.trim(),
        slug: slug.trim(),
        isActive,
      });
      toast.success("Form settings saved.");
      await reloadList();
    } catch (err) {
      toast.error(
        "Couldn't save form settings.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSavingMeta(false);
    }
  }

  async function saveFields() {
    if (!selectedId) return;
    setSavingFields(true);
    try {
      const payload = fields.map((f, i) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        fieldOrder: i,
        optionsJson: f.optionsJson,
        validationJson: f.validationJson,
      }));
      await replaceAdminFormFields(selectedId, payload);
      toast.success("Fields saved.");
      await reloadList();
    } catch (err) {
      toast.error(
        "Couldn't save fields.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSavingFields(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!createName.trim() || !createSlug.trim()) {
      toast.warning("Name and slug are required.");
      return;
    }
    setCreating(true);
    try {
      await createAdminForm({
        name: createName.trim(),
        slug: createSlug.trim(),
        isActive: true,
        fields: [
          {
            key: "fullName",
            label: "Full name",
            type: "text",
            required: true,
            fieldOrder: 0,
          },
          {
            key: "email",
            label: "Email",
            type: "email",
            required: true,
            fieldOrder: 1,
          },
        ],
      });
      toast.success("Form created.");
      setShowCreate(false);
      setCreateName("");
      setCreateSlug("");
      await reloadList();
    } catch (err) {
      toast.error(
        "Couldn't create form.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setCreating(false);
    }
  }

  async function onDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteAdminForm(deleteId);
      toast.success("Form deleted.");
      if (selectedId === deleteId) setSelectedId(null);
      setDeleteId(null);
      await reloadList();
    } catch (err) {
      toast.error(
        "Couldn't delete form.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setDeleting(false);
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
    } catch {
      toast.warning("Clipboard blocked — copy manually.");
    }
  }

  const fieldsClean = useMemo(
    () =>
      fields.every((f) => f.key.trim() !== "" && f.label.trim() !== ""),
    [fields],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Catalog
        </p>
        <h1 className="mt-1.5 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Forms
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          Lead-capture forms you can embed on any website. Submissions land in CRM.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <SxPanel
          title="Forms"
          action={
            <SxButton size="sm" onClick={() => setShowCreate(true)}>
              + New
            </SxButton>
          }
          padded={false}
        >
          {loading ? (
            <p className="p-5 text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
          ) : forms.length === 0 ? (
            <div className="p-5">
              <SxEmptyState
                title="No forms yet."
                description="Create one to start capturing leads."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {forms.map((f) => {
                const active = f.id === selectedId;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(f.id)}
                      className={[
                        "block w-full px-4 py-3 text-left transition-colors",
                        active
                          ? "bg-[var(--color-brand-50)]"
                          : "hover:bg-[var(--surface-sunken)]",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
                          {f.name}
                        </p>
                        <SxBadge
                          variant={f.isActive ? "success" : "closed"}
                          withDot={false}
                        >
                          {f.isActive ? "Active" : "Inactive"}
                        </SxBadge>
                      </div>
                      <p className="mt-1 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                        /{f.slug} · {f.fieldCount} fields ·{" "}
                        {f.submissionCount} subs
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SxPanel>

        <div className="flex flex-col gap-4">
          {!selectedId ? (
            <SxPanel>
              <p className="text-sx-sm text-[var(--text-tertiary)]">
                Pick a form on the left to edit it.
              </p>
            </SxPanel>
          ) : detailLoading || !detail ? (
            <SxPanel>
              <p className="text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
            </SxPanel>
          ) : (
            <>
              <SxPanel title="Settings">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SxInput
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <SxInput
                    label="Slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    helpText="Used in the public submit URL."
                  />
                  <label className="flex items-center gap-2 text-sx-sm text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 accent-[var(--color-brand-500)]"
                    />
                    Accepting submissions
                  </label>
                  <p className="font-mono text-sx-xs text-[var(--text-tertiary)] sm:col-span-2">
                    Last update: {formatDate(detail.updatedAt)}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SxButton loading={savingMeta} onClick={() => void saveMeta()}>
                    Save settings
                  </SxButton>
                  <SxButton
                    variant="ghost"
                    className="!text-[var(--color-danger-fg)]"
                    onClick={() => setDeleteId(detail.id)}
                  >
                    Delete form
                  </SxButton>
                </div>
              </SxPanel>

              <SxPanel
                title="Fields"
                action={
                  <SxButton size="sm" variant="secondary" onClick={addField}>
                    + Add field
                  </SxButton>
                }
              >
                {fields.length === 0 ? (
                  <p className="text-sx-sm text-[var(--text-tertiary)]">
                    No fields yet. Add one above.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {fields.map((f, idx) => (
                      <li
                        key={`${f.key}-${idx}`}
                        className="rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3"
                      >
                        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px_auto]">
                          <SxInput
                            label="Key"
                            value={f.key}
                            onChange={(e) =>
                              updateField(idx, { key: e.target.value })
                            }
                          />
                          <SxInput
                            label="Label"
                            value={f.label}
                            onChange={(e) =>
                              updateField(idx, { label: e.target.value })
                            }
                          />
                          <SxSelect
                            label="Type"
                            value={f.type}
                            onChange={(e) =>
                              updateField(idx, {
                                type: e.target.value as FormFieldRow["type"],
                              })
                            }
                          >
                            {FIELD_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </SxSelect>
                          <div className="flex flex-col gap-2">
                            <label className="text-sx-xs font-semibold text-[var(--text-primary)]">
                              Actions
                            </label>
                            <div className="flex h-[38px] items-center gap-1">
                              <SxButton
                                variant="ghost"
                                size="sm"
                                onClick={() => moveField(idx, -1)}
                                disabled={idx === 0}
                              >
                                ↑
                              </SxButton>
                              <SxButton
                                variant="ghost"
                                size="sm"
                                onClick={() => moveField(idx, 1)}
                                disabled={idx === fields.length - 1}
                              >
                                ↓
                              </SxButton>
                              <SxButton
                                variant="ghost"
                                size="sm"
                                className="!text-[var(--color-danger-fg)]"
                                onClick={() => removeField(idx)}
                              >
                                ✕
                              </SxButton>
                            </div>
                          </div>
                        </div>
                        <label className="mt-3 inline-flex items-center gap-2 text-sx-xs text-[var(--text-primary)]">
                          <input
                            type="checkbox"
                            checked={f.required}
                            onChange={(e) =>
                              updateField(idx, { required: e.target.checked })
                            }
                            className="h-4 w-4 accent-[var(--color-brand-500)]"
                          />
                          Required
                        </label>
                        {f.type === "select" ? (
                          <SxTextarea
                            label="Options (one per line)"
                            value={
                              Array.isArray(f.optionsJson)
                                ? f.optionsJson
                                    .map((v) => (typeof v === "string" ? v : String(v)))
                                    .join("\n")
                                : ""
                            }
                            onChange={(e) =>
                              updateField(idx, {
                                optionsJson: e.target.value
                                  .split("\n")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                            containerClassName="mt-3"
                            rows={3}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4">
                  <SxButton
                    loading={savingFields}
                    onClick={() => void saveFields()}
                    disabled={!fieldsClean}
                  >
                    Save fields
                  </SxButton>
                  {!fieldsClean ? (
                    <span className="ml-3 text-sx-xs text-[var(--color-warning-fg)]">
                      Every field needs a key and label.
                    </span>
                  ) : null}
                </div>
              </SxPanel>

              {embed ? (
                <SxPanel title="Embed">
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                        Submit URL
                      </p>
                      <div className="mt-1 flex gap-2">
                        <code className="flex-1 truncate rounded-sx-sm border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 font-mono text-sx-xs text-[var(--text-primary)]">
                          {embed.submitUrl}
                        </code>
                        <SxButton
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void copyToClipboard(embed.submitUrl, "Submit URL")
                          }
                        >
                          Copy
                        </SxButton>
                      </div>
                    </div>

                    <div>
                      <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                        Iframe HTML snippet
                      </p>
                      <SxTextarea
                        hideLabel
                        label="HTML snippet"
                        value={embed.htmlSnippet}
                        readOnly
                        rows={4}
                        containerClassName="mt-1"
                      />
                      <div className="mt-2">
                        <SxButton
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void copyToClipboard(
                              embed.htmlSnippet,
                              "HTML snippet",
                            )
                          }
                        >
                          Copy HTML
                        </SxButton>
                      </div>
                    </div>

                    {embed.scriptSnippet ? (
                      <div>
                        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                          Script snippet
                        </p>
                        <SxTextarea
                          hideLabel
                          label="Script snippet"
                          value={embed.scriptSnippet}
                          readOnly
                          rows={4}
                          containerClassName="mt-1"
                        />
                        <div className="mt-2">
                          <SxButton
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              void copyToClipboard(
                                embed.scriptSnippet!,
                                "Script snippet",
                              )
                            }
                          >
                            Copy script
                          </SxButton>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </SxPanel>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Create form modal */}
      {showCreate ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"
          onClick={() => !creating && setShowCreate(false)}
        >
          <div
            role="dialog"
            aria-modal
            className="w-full max-w-md rounded-sx-xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-sx-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={(e) => void onCreate(e)} className="p-6">
              <h2 className="font-display text-sx-xl font-semibold text-[var(--text-primary)]">
                New form
              </h2>
              <p className="mt-2 text-sx-sm text-[var(--text-secondary)]">
                Starts with two basic fields (full name, email). Add or remove fields after creating.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <SxInput
                  label="Name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Contact us"
                  required
                  autoFocus
                />
                <SxInput
                  label="Slug"
                  value={createSlug}
                  onChange={(e) => setCreateSlug(e.target.value)}
                  placeholder="contact-us"
                  required
                />
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <SxButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreate(false)}
                  disabled={creating}
                >
                  Cancel
                </SxButton>
                <SxButton type="submit" loading={creating}>
                  Create form
                </SxButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <SxConfirmDialog
        open={deleteId !== null}
        title="Delete this form?"
        body="The form stops accepting submissions immediately. Existing CRM leads are kept. This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={() => void onDelete()}
        onCancel={() => !deleting && setDeleteId(null)}
      />
    </div>
  );
}
