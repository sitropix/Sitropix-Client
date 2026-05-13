import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { ApiRequestError, isModuleForbiddenError } from "@/services/http";
import {
  createAdminForm,
  fetchAdminFormDetail,
  fetchAdminFormEmbed,
  fetchAdminForms,
  patchAdminForm,
  replaceAdminFormFields,
} from "@/services/subscriptionsApi";
import type {
  FormDefinitionDetail,
  FormDefinitionListItem,
  FormFieldRow,
} from "@/types/subscription";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FormEvent, useCallback, useEffect, useState } from "react";

const FIELD_TYPES = [
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
] as const;

type LocalField = Omit<FormFieldRow, "id"> & { draftId: string };

function newDraftId() {
  return crypto.randomUUID();
}

/** Matches server slug rule: lowercase alphanumerics with single hyphens between segments (no `--`, no leading/trailing `-`). */
function normalizeSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatFlattenedIssues(issues: unknown): string | null {
  if (!issues || typeof issues !== "object") return null;
  const f = issues as {
    formErrors?: string[];
    fieldErrors?: Record<string, string[] | undefined>;
  };
  const parts: string[] = [...(f.formErrors ?? [])];
  for (const [key, errs] of Object.entries(f.fieldErrors ?? {})) {
    if (errs?.length) parts.push(`${key}: ${errs.join("; ")}`);
  }
  return parts.length ? parts.join(" ") : null;
}

function formatFormCreateFailure(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.status === 409)
      return "That slug is already in use. Choose a different URL slug.";
    const fromIssues = formatFlattenedIssues(err.issues);
    if (err.status === 400 && fromIssues) return `Invalid form: ${fromIssues}`;
    if (err.status === 403 && err.code === "module_forbidden")
      return "You don't have access to the Forms module.";
    return err.message || "Could not create form.";
  }
  return "Could not create form.";
}

function defaultFields(): LocalField[] {
  const industryOpts = [
    "Software & Technology",
    "Healthcare",
    "Finance & Banking",
    "Retail & E-commerce",
    "Manufacturing",
    "Education",
    "Professional Services",
    "Other",
  ];
  const goalOpts = [
    "Product demo",
    "Partnership",
    "Support",
    "General inquiry",
    "Other",
  ];
  const timelineOpts = [
    "ASAP",
    "1–3 months",
    "3–6 months",
    "6+ months",
    "Just exploring",
  ];
  const budgetOpts = [
    "Under $5k",
    "$5k–$25k",
    "$25k–$100k",
    "$100k+",
    "Prefer not to say",
  ];
  const base: Omit<LocalField, "draftId">[] = [
    {
      key: "first_name",
      label: "First Name",
      type: "text",
      required: true,
      fieldOrder: 0,
      optionsJson: [],
      validationJson: {
        sectionKey: "name",
        sectionTitle: "Enter Your Name",
        sectionRequired: true,
        layout: "half",
      },
    },
    {
      key: "last_name",
      label: "Last Name",
      type: "text",
      required: true,
      fieldOrder: 1,
      optionsJson: [],
      validationJson: { sectionKey: "name", layout: "half" },
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      required: true,
      fieldOrder: 2,
      optionsJson: [],
      validationJson: {
        sectionKey: "email",
        sectionTitle: "Enter your Email address",
        sectionRequired: true,
        placeholder: "you@company.com",
      },
    },
    {
      key: "phone",
      label: "Phone",
      type: "tel",
      required: false,
      fieldOrder: 3,
      optionsJson: [],
      validationJson: {
        sectionKey: "phone",
        sectionTitle: "Enter your Phone Number",
        sectionRequired: false,
        placeholder: "+1 …",
      },
    },
    {
      key: "company",
      label: "Company",
      type: "text",
      required: false,
      fieldOrder: 4,
      optionsJson: [],
      validationJson: {
        sectionKey: "company",
        sectionTitle: "Business Name",
        sectionRequired: false,
        placeholder: "Company name",
      },
    },
    {
      key: "industry",
      label: "Industry",
      type: "select",
      required: false,
      fieldOrder: 5,
      optionsJson: industryOpts,
      validationJson: {
        sectionKey: "industry",
        sectionTitle: "Industry",
        sectionRequired: false,
        placeholder: "Select an option",
      },
    },
    {
      key: "primary_goal",
      label: "Primary Goal",
      type: "select",
      required: false,
      fieldOrder: 6,
      optionsJson: goalOpts,
      validationJson: {
        sectionKey: "goal",
        sectionTitle: "What is your Primary Goal",
        sectionRequired: false,
        placeholder: "Select an option",
      },
    },
    {
      key: "timeline",
      label: "Timeline",
      type: "select",
      required: false,
      fieldOrder: 7,
      optionsJson: timelineOpts,
      validationJson: {
        sectionKey: "timeline",
        sectionTitle: "What is your Timeline",
        sectionRequired: false,
        placeholder: "Select an option",
      },
    },
    {
      key: "budget_range",
      label: "Budget Range",
      type: "select",
      required: false,
      fieldOrder: 8,
      optionsJson: budgetOpts,
      validationJson: {
        sectionKey: "budget",
        sectionTitle: "Budget Range",
        sectionRequired: false,
        placeholder: "Select an option",
      },
    },
    {
      key: "additional_info",
      label: "Anything else we should know?",
      type: "textarea",
      required: false,
      fieldOrder: 9,
      optionsJson: [],
      validationJson: {
        sectionKey: "notes",
        sectionTitle: "Anything else we should know?",
        sectionRequired: false,
        placeholder: "Type your answer here…",
      },
    },
    {
      key: "discovery_call",
      label: "Would you like to book a discovery call?",
      type: "select",
      required: false,
      fieldOrder: 10,
      optionsJson: ["Yes", "No"],
      validationJson: {
        sectionKey: "discovery",
        sectionTitle: "Would you like to book a discovery call?",
        sectionRequired: false,
        placeholder: "Select an option",
      },
    },
  ];
  return base.map((row) => ({ ...row, draftId: newDraftId() }));
}

function toApiField(f: LocalField, order: number): Omit<FormFieldRow, "id"> {
  const { draftId: _, ...rest } = f;
  const v = (rest.validationJson ?? {}) as Record<string, unknown>;
  const cleaned = { ...v };
  for (const k of Object.keys(cleaned)) {
    const val = cleaned[k];
    if (val === undefined) delete cleaned[k];
    else if (val === "" || val === null) delete cleaned[k];
    else if (k === "strictE164" && val === false) delete cleaned[k];
  }
  const rawOpts = rest.optionsJson;
  const optionsJson = Array.isArray(rawOpts)
    ? rawOpts
        .map((x) => (x == null ? "" : String(x).trim()))
        .filter((s) => s.length > 0)
    : [];
  return {
    ...rest,
    fieldOrder: order,
    validationJson: cleaned,
    optionsJson,
  };
}

function readVj(f: LocalField): Record<string, unknown> {
  const v = f.validationJson;
  return v && typeof v === "object"
    ? { ...(v as Record<string, unknown>) }
    : {};
}

function DragHandleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="9" cy="7" r="1.25" />
      <circle cx="15" cy="7" r="1.25" />
      <circle cx="9" cy="12" r="1.25" />
      <circle cx="15" cy="12" r="1.25" />
      <circle cx="9" cy="17" r="1.25" />
      <circle cx="15" cy="17" r="1.25" />
    </svg>
  );
}

function SortableFieldCard({
  field,
  index,
  onPatch,
  onRemove,
}: {
  field: LocalField;
  index: number;
  onPatch: (idx: number, patch: Partial<LocalField>) => void;
  onRemove: (idx: number) => void;
}) {
  const vj = readVj(field);
  const placeholder = typeof vj.placeholder === "string" ? vj.placeholder : "";
  const strictE164 = vj.strictE164 === true;
  const pattern = typeof vj.pattern === "string" ? vj.pattern : "";
  const defaultValue =
    typeof vj.defaultValue === "string" ? vj.defaultValue : "";
  const minLength = vj.minLength != null ? String(vj.minLength) : "";
  const maxLength = vj.maxLength != null ? String(vj.maxLength) : "";
  const numMin = vj.min != null ? String(vj.min) : "";
  const numMax = vj.max != null ? String(vj.max) : "";
  const numStep = vj.step != null ? String(vj.step) : "";

  function patchValidation(next: Record<string, unknown>) {
    const merged: Record<string, unknown> = { ...readVj(field), ...next };
    for (const k of Object.keys(merged)) {
      if (merged[k] === undefined) delete merged[k];
    }
    onPatch(index, {
      validationJson: merged,
    });
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.draftId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const showPlaceholder =
    field.type !== "checkbox" &&
    field.type !== "hidden" &&
    field.type !== "file" &&
    field.type !== "select" &&
    field.type !== "date";

  const showLengthPattern =
    field.type === "text" ||
    field.type === "textarea" ||
    field.type === "email" ||
    field.type === "url";

  const showPhoneExtra = field.type === "tel" || field.type === "phone";

  const showNumberMeta = field.type === "number";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-white/10 bg-black/20"
    >
      <div className="grid gap-3 p-4 md:grid-cols-12">
        <button
          type="button"
          className="md:col-span-1 flex cursor-grab touch-none items-start justify-center rounded border border-white/10 bg-black/40 py-3 text-neutral-400 hover:bg-white/[0.06] active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder field"
        >
          <DragHandleIcon />
        </button>

        <label className="md:col-span-3 text-xs">
          <span className="text-neutral-500">Key</span>
          <input
            className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-white"
            value={field.key}
            onChange={(e) => onPatch(index, { key: e.target.value })}
          />
        </label>
        <label className="md:col-span-3 text-xs">
          <span className="text-neutral-500">Label</span>
          <input
            className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
            value={field.label}
            onChange={(e) => onPatch(index, { label: e.target.value })}
          />
        </label>
        <label className="md:col-span-2 text-xs">
          <span className="text-neutral-500">Type</span>
          <select
            className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
            value={field.type}
            onChange={(e) =>
              onPatch(index, {
                type: e.target.value as FormFieldRow["type"],
              })
            }
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2 flex flex-col justify-end text-xs">
          <span className="text-neutral-500">Required</span>
          <input
            type="checkbox"
            className="mt-2 h-4 w-4 accent-brand-lime"
            checked={field.required}
            onChange={(e) => onPatch(index, { required: e.target.checked })}
          />
        </label>
        <div className="md:col-span-1 flex items-end justify-end pb-1">
          <button
            type="button"
            className="text-xs text-red-400 hover:underline"
            onClick={() => onRemove(index)}
          >
            Remove
          </button>
        </div>

        {field.type === "select" ? (
          <label className="md:col-span-12 text-xs">
            <span className="text-neutral-500">Options (comma-separated)</span>
            <input
              className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
              value={(field.optionsJson ?? []).join(", ")}
              onChange={(e) => {
                const opts = e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                onPatch(index, { optionsJson: opts });
              }}
            />
          </label>
        ) : null}

        <details className="md:col-span-12 rounded-lg border border-white/10 bg-black/25">
          <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold text-brand-lime/95">
            Placeholder & validation
          </summary>
          <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-4">
            {field.type === "hidden" ? (
              <label className="block text-xs">
                <span className="text-neutral-500">
                  Default value (stored server-side; not shown publicly)
                </span>
                <input
                  className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-xs text-white"
                  value={defaultValue}
                  onChange={(e) =>
                    patchValidation({ defaultValue: e.target.value })
                  }
                  placeholder="utm_source=web"
                />
              </label>
            ) : null}

            {showPlaceholder ? (
              <label className="block text-xs">
                <span className="text-neutral-500">Placeholder</span>
                <input
                  className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white"
                  value={placeholder}
                  onChange={(e) =>
                    patchValidation({ placeholder: e.target.value })
                  }
                  placeholder="Shown inside the empty field on the public form"
                />
              </label>
            ) : null}

            {showLengthPattern ? (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs">
                  <span className="text-neutral-500">Min length</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                    value={minLength}
                    onChange={(e) =>
                      patchValidation({
                        minLength:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-xs">
                  <span className="text-neutral-500">Max length</span>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                    value={maxLength}
                    onChange={(e) =>
                      patchValidation({
                        maxLength:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-xs md:col-span-3">
                  <span className="text-neutral-500">
                    Regex pattern (JavaScript)
                  </span>
                  <input
                    className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-white"
                    value={pattern}
                    onChange={(e) =>
                      patchValidation({ pattern: e.target.value || undefined })
                    }
                  />
                </label>
              </div>
            ) : null}

            {showPhoneExtra ? (
              <label className="flex items-center gap-2 text-xs text-neutral-400">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-lime"
                  checked={strictE164}
                  onChange={(e) =>
                    patchValidation({ strictE164: e.target.checked })
                  }
                />
                Require E.164 format (e.g. +14155552671)
              </label>
            ) : null}

            {showPhoneExtra ? (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs md:col-span-3">
                  <span className="text-neutral-500">
                    Optional min / max length (digits + symbols)
                  </span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="number"
                      placeholder="min"
                      className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                      value={minLength}
                      onChange={(e) =>
                        patchValidation({
                          minLength:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                    />
                    <input
                      type="number"
                      placeholder="max"
                      className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                      value={maxLength}
                      onChange={(e) =>
                        patchValidation({
                          maxLength:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </label>
              </div>
            ) : null}

            {showNumberMeta ? (
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs">
                  <span className="text-neutral-500">Min value</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                    value={numMin}
                    onChange={(e) =>
                      patchValidation({
                        min:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-xs">
                  <span className="text-neutral-500">Max value</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                    value={numMax}
                    onChange={(e) =>
                      patchValidation({
                        max:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-xs">
                  <span className="text-neutral-500">Step</span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                    value={numStep}
                    onChange={(e) =>
                      patchValidation({
                        step:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}

export function FormBuilderPage() {
  const [items, setItems] = useState<FormDefinitionListItem[]>([]);
  const [detail, setDetail] = useState<FormDefinitionDetail | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noModuleAccess, setNoModuleAccess] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [settingsJson, setSettingsJson] = useState(
    [
      "{",
      '  "allowedOrigins": [],',
      `  "calEmbedUrl": "${String(import.meta.env.VITE_CAL_EMBED_URL ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}",`,
      '  "calIntegration": true,',
      '  "calDiscoveryFieldKey": "discovery_call",',
      '  "calDiscoveryYesValues": ["Yes", "yes"],',
      '  "brandLogoText": null,',
      '  "footerAttribution": "Powered by Sitropix"',
      "}",
    ].join("\n"),
  );
  const [fieldDraft, setFieldDraft] = useState<LocalField[]>(defaultFields());
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [saveSubmitting, setSaveSubmitting] = useState(false);
  const [embedOpen, setEmbedOpen] = useState<string | null>(null);
  const [embedPayload, setEmbedPayload] = useState<{
    htmlSnippet: string;
    iframeSrc: string;
    scriptSnippet?: string;
    submitUrlV1?: string;
    configUrlV1?: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const patchField = useCallback((idx: number, patch: Partial<LocalField>) => {
    setFieldDraft((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    );
  }, []);

  const removeField = useCallback((idx: number) => {
    setFieldDraft((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFieldDraft((rows) => {
      const oldIndex = rows.findIndex((r) => r.draftId === active.id);
      const newIndex = rows.findIndex((r) => r.draftId === over.id);
      if (oldIndex < 0 || newIndex < 0) return rows;
      return arrayMove(rows, oldIndex, newIndex);
    });
  }, []);

  async function loadList() {
    const res = await fetchAdminForms();
    setItems(res.items);
  }

  async function openDetail(id: string) {
    setNotice(null);
    const d = await fetchAdminFormDetail(id);
    setDetail(d);
    setFieldDraft(
      d.fields.map((f) => ({
        draftId: newDraftId(),
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        fieldOrder: f.fieldOrder,
        optionsJson: Array.isArray(f.optionsJson)
          ? (f.optionsJson as string[])
          : [],
        validationJson: (f.validationJson as Record<string, unknown>) ?? {},
      })),
    );
    try {
      const parsed = JSON.stringify(d.settingsJson ?? {}, null, 2);
      setSettingsJson(parsed);
    } catch {
      setSettingsJson("{}");
    }
  }

  useEffect(() => {
    void loadList().catch((err) => {
      if (isModuleForbiddenError(err)) setNoModuleAccess(true);
      else setNotice("Could not load forms.");
    });
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const slugNorm = normalizeSlugInput(slug);
    if (!name.trim() || !slugNorm) return;
    setCreating(true);
    setNotice(null);
    try {
      let settings: Record<string, unknown> = {};
      try {
        settings = JSON.parse(settingsJson || "{}") as Record<string, unknown>;
      } catch {
        setNotice("Settings JSON is invalid.");
        setCreating(false);
        return;
      }
      const created = await createAdminForm({
        name: name.trim(),
        slug: slugNorm,
        isActive: true,
        settingsJson: settings,
        fields: fieldDraft.map((f, i) => toApiField(f, i)),
      });
      setName("");
      setSlug("");
      setFieldDraft(defaultFields());
      await loadList();
      await openDetail(created.id);
      setNotice("Form created.");
    } catch (err) {
      setNotice(formatFormCreateFailure(err));
    } finally {
      setCreating(false);
    }
  }

  async function saveDetail(): Promise<boolean> {
    if (!detail) return false;
    setNotice(null);
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(settingsJson || "{}") as Record<string, unknown>;
    } catch {
      setNotice("Settings JSON is invalid.");
      return false;
    }
    try {
      await patchAdminForm(detail.id, { settingsJson: settings });
      await replaceAdminFormFields(
        detail.id,
        fieldDraft.map((f, i) => toApiField(f, i)),
      );
      await loadList();
      await openDetail(detail.id);
      setNotice("Saved.");
      return true;
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const issueText =
          err.status === 400 ? formatFlattenedIssues(err.issues) : null;
        setNotice(
          issueText
            ? `Save failed: ${issueText}`
            : err.message || err.code || "Save failed.",
        );
      } else {
        setNotice("Save failed.");
      }
      return false;
    }
  }

  async function loadEmbed(formId: string) {
    setEmbedOpen(formId);
    const e = await fetchAdminFormEmbed(formId);
    setEmbedPayload({
      htmlSnippet: e.htmlSnippet,
      iframeSrc: e.iframeSrc,
      scriptSnippet: e.scriptSnippet,
      submitUrlV1: e.submitUrlV1,
      configUrlV1: e.configUrlV1,
    });
  }

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Forms" />;
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-white">
          Form builder
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Create embeddable lead capture forms. Drag fields to reorder; expand
          &quot;Placeholder &amp; validation&quot; for rules. Submissions flow
          into the CRM module.
        </p>
      </header>

      {notice ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200">
          {notice}
        </p>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-[#15191C] p-6">
        <h2 className="text-lg font-bold text-white">New form</h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={onCreate}>
          <label className="block text-sm">
            <span className="text-neutral-400">Display name</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-brand-lime/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Partner intake"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-400">Slug (URL-safe)</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-brand-lime/50"
              value={slug}
              onChange={(e) => setSlug(normalizeSlugInput(e.target.value))}
              placeholder="partner-intake"
              required
              aria-describedby="form-slug-hint"
            />
            <span
              id="form-slug-hint"
              className="mt-1 block text-xs text-neutral-500"
            >
              Lowercase letters, numbers, single hyphens only (e.g.
              partner-intake). Spaces become hyphens.
            </span>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-neutral-400">
              Settings JSON (allowedOrigins, calEmbedUrl, calIntegration,
              calDiscoveryFieldKey, brandLogoText, footerAttribution)
            </span>
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none focus:border-brand-lime/50"
              value={settingsJson}
              onChange={(e) => setSettingsJson(e.target.value)}
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-brand-lime px-4 py-2 text-sm font-bold text-canvas hover:brightness-110 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create form"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#15191C] p-6">
        <h2 className="text-lg font-bold text-white">Your forms</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 text-neutral-400">
              <tr>
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Slug</th>
                <th className="pb-2 pr-4">Active</th>
                <th className="pb-2 pr-4">Submissions</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((row) => (
                <tr key={row.id} className="text-neutral-200">
                  <td className="py-3 pr-4 font-medium">{row.name}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-neutral-400">
                    {row.slug}
                  </td>
                  <td className="py-3 pr-4">{row.isActive ? "Yes" : "No"}</td>
                  <td className="py-3 pr-4">{row.submissionCount}</td>
                  <td className="py-3 space-x-2">
                    <button
                      type="button"
                      className="text-brand-lime hover:underline"
                      onClick={() => void openDetail(row.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-neutral-400 hover:text-white"
                      onClick={() => void loadEmbed(row.id)}
                    >
                      Embed
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-neutral-500">
                    No forms yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {detail ? (
        <section className="rounded-2xl border border-brand-lime/25 bg-[#15191C] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                Editing: {detail.name}
              </h2>
              <p className="mt-1 font-mono text-xs text-neutral-500">
                embedKey: {detail.embedKey}
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/[0.06]"
              onClick={() => setDetail(null)}
            >
              Close
            </button>
          </div>

          <label className="mt-6 block text-sm">
            <span className="text-neutral-400">Settings JSON</span>
            <textarea
              className="mt-1 min-h-[120px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none focus:border-brand-lime/50"
              value={settingsJson}
              onChange={(e) => setSettingsJson(e.target.value)}
            />
          </label>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Fields</h3>
              <button
                type="button"
                className="text-sm text-brand-lime hover:underline"
                onClick={() =>
                  setFieldDraft((prev) => [
                    ...prev,
                    {
                      draftId: newDraftId(),
                      key: `field_${prev.length + 1}`,
                      label: "New field",
                      type: "text",
                      required: false,
                      fieldOrder: prev.length,
                      optionsJson: [],
                      validationJson: {},
                    },
                  ])
                }
              >
                Add field
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fieldDraft.map((f) => f.draftId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {fieldDraft.map((f, idx) => (
                    <SortableFieldCard
                      key={f.draftId}
                      field={f}
                      index={idx}
                      onPatch={patchField}
                      onRemove={removeField}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg bg-brand-lime px-4 py-2 text-sm font-bold text-canvas hover:brightness-110"
              onClick={() => setSaveConfirmOpen(true)}
            >
              Save changes
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/[0.06]"
              onClick={() => detail && void loadEmbed(detail.id)}
            >
              Get embed code
            </button>
          </div>
        </section>
      ) : null}

      {embedOpen && embedPayload ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#12181f] p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white">Embed</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Host this URL in an iframe on your marketing site, or POST
              directly to the submit URL from your own UI.
            </p>
            <label className="mt-4 block text-xs text-neutral-500">
              iframe src
              <input
                readOnly
                className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-2 font-mono text-xs text-white"
                value={embedPayload.iframeSrc}
              />
            </label>
            <label className="mt-4 block text-xs text-neutral-500">
              HTML snippet (iframe)
              <textarea
                readOnly
                className="mt-1 min-h-[160px] w-full rounded border border-white/10 bg-black/40 px-2 py-2 font-mono text-xs text-white"
                value={embedPayload.htmlSnippet}
              />
            </label>
            {embedPayload.scriptSnippet ? (
              <label className="mt-4 block text-xs text-neutral-500">
                Script embed (replace __CSP_NONCE__ with your page nonce)
                <textarea
                  readOnly
                  className="mt-1 min-h-[120px] w-full rounded border border-white/10 bg-black/40 px-2 py-2 font-mono text-xs text-white"
                  value={embedPayload.scriptSnippet}
                />
              </label>
            ) : null}
            {embedPayload.configUrlV1 ? (
              <p className="mt-2 text-xs text-neutral-500">
                v1 config:{" "}
                <span className="font-mono text-neutral-300">
                  {embedPayload.configUrlV1}
                </span>
                <br />
                v1 submit:{" "}
                <span className="font-mono text-neutral-300">
                  {embedPayload.submitUrlV1}
                </span>
              </p>
            ) : null}
            <button
              type="button"
              className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm text-white"
              onClick={() => {
                setEmbedOpen(null);
                setEmbedPayload(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={saveConfirmOpen}
        title="Save form changes?"
        description={
          detail ? (
            <>
              This will update <span className="font-semibold text-white">{detail.name}</span>{" "}
              (settings and all fields) on the server. Continue?
            </>
          ) : (
            "Save settings and fields to the server?"
          )
        }
        confirmLabel="Save changes"
        cancelLabel="Cancel"
        loading={saveSubmitting}
        onConfirm={() => {
          void (async () => {
            setSaveSubmitting(true);
            try {
              const ok = await saveDetail();
              if (ok) setSaveConfirmOpen(false);
            } finally {
              setSaveSubmitting(false);
            }
          })();
        }}
        onCancel={() => {
          if (!saveSubmitting) setSaveConfirmOpen(false);
        }}
      />
    </div>
  );
}
