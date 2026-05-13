import {
  type Dispatch,
  type SetStateAction,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { z } from "zod";

type FieldConfig = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  optionsJson?: unknown;
  validationJson?: unknown;
};

type FormConfigResponse = {
  csrfToken: string;
  name: string;
  settings: {
    calEmbedUrl?: string | null;
    calLink?: string | null;
    calIntegration?: boolean;
    calDiscoveryFieldKey?: string;
    calDiscoveryYesValues?: string[];
    brandLogoText?: string | null;
    footerAttribution?: string | null;
    allowedOrigins?: string[];
  };
  fields: FieldConfig[];
};

type ValidationIssue = {
  key: string;
  message: string;
};

type SubmitErrorBody = {
  error?: string;
  message?: string;
  issues?: unknown;
};

/** Same base as authenticated API calls — required when the UI is on a different host than the API. */
const API_ORIGIN = import.meta.env.VITE_API_BASE_URL ?? "";
function publicFormApiUrl(path: string) {
  return `${API_ORIGIN}${path}`;
}

/**
 * Build a Cal.com iframe URL from calEmbedUrl or calLink.
 * Adds ?embed=1 so the page renders in minimal frame mode.
 */
function buildCalIframeUrl(calEmbedUrl: string, calLink: string): string {
  // prefer the full URL if given, otherwise construct from path
  const base = calEmbedUrl.startsWith("http")
    ? calEmbedUrl
    : calLink
      ? `https://cal.com/${calLink.replace(/^\/+/, "")}`
      : "";
  if (!base) return "";
  try {
    const u = new URL(base);
    u.searchParams.set("embed", "1");
    return u.toString();
  } catch {
    return base;
  }
}

/** Cal fires postMessage events from inside the booking iframe. */
function parseCalBookingMessage(event: MessageEvent): {
  uid?: string;
  videoCallUrl?: string;
} | null {
  const d = event.data;
  if (!d || typeof d !== "object") return null;

  // Cal's embed posts: { originator: "CAL", type: "...", data: {...} }
  // or: { type: "bookingSuccessfulV2", data: {...} }
  // or the action directly on d itself
  const isCalOriginator = d.originator === "CAL";
  const type: string = String(d.type ?? d.action ?? "");
  const isBookingSuccess =
    type.toLowerCase().includes("bookingsuccessful") ||
    type.toLowerCase().includes("booking_successful");

  if (!isCalOriginator && !isBookingSuccess) return null;
  if (!isBookingSuccess) return null;

  const payload = d.data ?? d;
  return {
    uid: typeof payload.uid === "string" ? payload.uid : undefined,
    videoCallUrl:
      typeof payload.videoCallUrl === "string"
        ? payload.videoCallUrl
        : typeof payload.meetingUrl === "string"
          ? payload.meetingUrl
          : undefined,
  };
}

function getVj(f: FieldConfig): Record<string, unknown> {
  const v = f.validationJson;
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function numAttr(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function strAttr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

function asIssueArray(v: unknown): ValidationIssue[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as { key?: unknown; message?: unknown };
      if (typeof r.key !== "string" || typeof r.message !== "string")
        return null;
      return { key: r.key, message: r.message };
    })
    .filter((row): row is ValidationIssue => Boolean(row));
}

function issueToText(issue: ValidationIssue, field?: FieldConfig): string {
  const name = field?.label || issue.key;
  const vj = field ? getVj(field) : {};
  const minL = numAttr(vj.minLength);
  const maxL = numAttr(vj.maxLength);
  const min = numAttr(vj.min);
  const max = numAttr(vj.max);

  switch (issue.message) {
    case "required":
      return `${name} is required.`;
    case "invalid_email":
      return `Please enter a valid email address.`;
    case "invalid_phone_e164":
      return `Please enter ${name} with country code (E.164), e.g. +919876543210.`;
    case "invalid_phone":
      return `Please enter a valid phone number.`;
    case "invalid_number":
      return `Please enter a valid number for ${name}.`;
    case "invalid_option":
      return `Please choose a valid option for ${name}.`;
    case "invalid_date":
      return `Please enter a valid date for ${name}.`;
    case "file_too_large":
      return `${name} is too large. Please upload a smaller file.`;
    case "min_length":
      return minL != null
        ? `${name} must be at least ${minL} characters.`
        : `${name} is too short.`;
    case "max_length":
      return maxL != null
        ? `${name} must be at most ${maxL} characters.`
        : `${name} is too long.`;
    case "pattern":
      if (
        (field?.type === "phone" || field?.type === "tel") &&
        vj.strictE164 === true
      ) {
        return `Please enter ${name} with country code (E.164), e.g. +919876543210.`;
      }
      return `Please enter ${name} in the expected format.`;
    case "min_value":
      return min != null
        ? `${name} must be at least ${min}.`
        : `${name} is below the minimum value.`;
    case "max_value":
      return max != null
        ? `${name} must be at most ${max}.`
        : `${name} is above the maximum value.`;
    default:
      return `Please check ${name}.`;
  }
}

/** Mirrors server `formAnswerValidation.mjs` so text/textarea “email” keys are checked the same way. */
function textFieldValidatesAsEmail(f: FieldConfig): boolean {
  if (f.type !== "text" && f.type !== "textarea") return false;
  const vj = getVj(f);
  if (vj.format === "email") return true;
  const kl = f.key.toLowerCase();
  return kl === "email" || kl === "e_mail" || kl.endsWith("_email");
}

function fieldSuppliesEmailAddress(f: FieldConfig): boolean {
  return f.type === "email" || textFieldValidatesAsEmail(f);
}

function collectEmailFieldErrors(
  fields: FieldConfig[],
  answers: Record<string, string | boolean>,
): Record<string, string> {
  const byKey: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === "hidden") continue;
    if (!fieldSuppliesEmailAddress(f)) continue;
    const raw = answers[f.key];
    if (raw === undefined || raw === null || raw === false) continue;
    const s = String(raw).trim();
    if (!s) continue;
    if (!z.string().email().safeParse(s).success) {
      byKey[f.key] = issueToText({ key: f.key, message: "invalid_email" }, f);
    }
  }
  return byKey;
}

type FieldSection = {
  sectionKey: string;
  sectionTitle?: string;
  sectionRequired: boolean;
  items: FieldConfig[];
};

function groupFieldsIntoSections(fields: FieldConfig[]): FieldSection[] {
  const visible = fields.filter((f) => f.type !== "hidden");
  const out: FieldSection[] = [];
  for (const f of visible) {
    const vj = getVj(f);
    const sk = strAttr(vj.sectionKey) ?? `__solo_${f.key}`;
    const last = out[out.length - 1];
    if (last && last.sectionKey === sk) {
      last.items.push(f);
    } else {
      out.push({
        sectionKey: sk,
        sectionTitle: strAttr(vj.sectionTitle),
        sectionRequired: vj.sectionRequired === true,
        items: [f],
      });
    }
  }
  for (const sec of out) {
    const titled = sec.items
      .map((i) => strAttr(getVj(i).sectionTitle))
      .find(Boolean);
    if (titled) sec.sectionTitle = titled;
    if (!sec.sectionRequired) {
      sec.sectionRequired = sec.items.some(
        (i) => getVj(i).sectionRequired === true,
      );
    }
  }
  return out;
}

function layoutRows(items: FieldConfig[]): FieldConfig[][] {
  const rows: FieldConfig[][] = [];
  for (const f of items) {
    const half = getVj(f).layout === "half";
    const prev = rows[rows.length - 1];
    if (half && prev && prev.length === 1 && getVj(prev[0]).layout === "half") {
      prev.push(f);
    } else {
      rows.push([f]);
    }
  }
  return rows;
}

function renderFieldControl(
  f: FieldConfig,
  answers: Record<string, string | boolean>,
  setAnswers: Dispatch<SetStateAction<Record<string, string | boolean>>>,
  fieldErrors: Record<string, string>,
) {
  const vj = getVj(f);
  const placeholder = strAttr(vj.placeholder);
  const numMin = numAttr(vj.min);
  const numMax = numAttr(vj.max);
  const numStep = numAttr(vj.step);
  const inputClass = `mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-brand-lime/50 ${
    fieldErrors[f.key] ? "border-red-500/70 ring-1 ring-red-500/25" : ""
  }`;

  if (f.type === "textarea") {
    return (
      <textarea
        required={f.required}
        placeholder={placeholder}
        className={`${inputClass} min-h-[120px] resize-y`}
        rows={4}
        value={(answers[f.key] as string) ?? ""}
        onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
      />
    );
  }
  if (f.type === "select") {
    const ph = placeholder || "Select an option";
    return (
      <select
        required={f.required}
        className={`${inputClass} appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238E8F93'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
        }}
        value={(answers[f.key] as string) ?? ""}
        onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
      >
        <option value="">{ph}</option>
        {(Array.isArray(f.optionsJson) ? f.optionsJson : []).map((opt) => (
          <option key={String(opt)} value={String(opt)}>
            {String(opt)}
          </option>
        ))}
      </select>
    );
  }
  if (f.type === "checkbox") {
    return (
      <input
        type="checkbox"
        className="mt-2 h-4 w-4 rounded border-white/20 accent-brand-lime"
        checked={Boolean(answers[f.key])}
        onChange={(e) =>
          setAnswers((a) => ({ ...a, [f.key]: e.target.checked }))
        }
      />
    );
  }
  if (f.type === "date") {
    return (
      <input
        type="date"
        required={f.required}
        className={inputClass}
        value={(answers[f.key] as string) ?? ""}
        onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
      />
    );
  }
  if (f.type === "file") {
    return (
      <input
        type="file"
        required={f.required}
        className={`mt-1.5 text-sm ${fieldErrors[f.key] ? "text-red-400" : "text-neutral-400"}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) {
            setAnswers((a) => ({ ...a, [f.key]: "" }));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const r = String(reader.result ?? "");
            const b64 = r.includes("base64,")
              ? (r.split("base64,")[1] ?? "")
              : r;
            setAnswers((a) => ({ ...a, [f.key]: b64 }));
          };
          reader.readAsDataURL(file);
        }}
      />
    );
  }
  const emailLike = fieldSuppliesEmailAddress(f);
  return (
    <input
      required={f.required}
      type={
        emailLike
          ? "email"
          : f.type === "number"
            ? "number"
            : f.type === "url"
              ? "url"
              : f.type === "tel" || f.type === "phone"
                ? "tel"
                : "text"
      }
      placeholder={placeholder}
      min={f.type === "number" && numMin !== undefined ? numMin : undefined}
      max={f.type === "number" && numMax !== undefined ? numMax : undefined}
      step={f.type === "number" && numStep !== undefined ? numStep : undefined}
      className={inputClass}
      value={(answers[f.key] as string) ?? ""}
      onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
      autoComplete={emailLike ? "email" : undefined}
      inputMode={emailLike ? "email" : undefined}
    />
  );
}

export function PublicEmbedFormPage() {
  const { embedKey } = useParams<{ embedKey: string }>();
  const [config, setConfig] = useState<FormConfigResponse | null>(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [meetingUrl, setMeetingUrl] = useState("");
  const [calBookingId, setCalBookingId] = useState("");
  const [schedulingSkipped, setSchedulingSkipped] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  // stable ref so the postMessage handler always calls the current setter
  const bookingHandlerRef = useRef<
    ((uid?: string, videoCallUrl?: string) => void) | null
  >(null);
  bookingHandlerRef.current = (uid, videoCallUrl) => {
    if (uid) setCalBookingId(uid);
    if (videoCallUrl) setMeetingUrl(videoCallUrl);
    setBookingConfirmed(true);
    setSchedulingSkipped(false);
  };

  useEffect(() => {
    if (!embedKey) return;
    setLoading(true);
    fetch(publicFormApiUrl(`/api/forms/${encodeURIComponent(embedKey)}/config`))
      .then(async (res) => {
        if (!res.ok) throw new Error("Form not found or inactive.");
        return res.json() as Promise<FormConfigResponse>;
      })
      .then((c) => {
        setConfig(c);
        setCsrfToken(c.csrfToken);
        const init: Record<string, string | boolean> = {};
        for (const f of c.fields) {
          if (f.type === "hidden") continue;
          if (f.type === "checkbox") init[f.key] = false;
          else init[f.key] = "";
        }
        setAnswers(init);
        setError(null);
        setFieldErrors({});
        setBookingConfirmed(false);
        setSchedulingSkipped(false);
        setMeetingUrl("");
        setCalBookingId("");
      })
      .catch(() => setError("Could not load form."))
      .finally(() => setLoading(false));
  }, [embedKey]);

  const discoveryFieldKey =
    config?.settings?.calDiscoveryFieldKey ?? "discovery_call";
  const discoveryYesValues = useMemo(
    () =>
      Array.isArray(config?.settings?.calDiscoveryYesValues) &&
      config.settings.calDiscoveryYesValues.length
        ? config.settings.calDiscoveryYesValues
        : ["Yes", "yes", "YES"],
    [config?.settings?.calDiscoveryYesValues],
  );

  const discoveryVal = String(answers[discoveryFieldKey] ?? "").trim();
  const wantsDiscoveryBook = discoveryYesValues.includes(discoveryVal);

  const calIntegration = Boolean(config?.settings?.calIntegration);
  const calLink = (config?.settings?.calLink ?? "").trim();
  const calEmbedUrl = (config?.settings?.calEmbedUrl ?? "").trim();
  const calIframeUrl = buildCalIframeUrl(calEmbedUrl, calLink);
  const showSchedulingBlock =
    Boolean(calIframeUrl) &&
    calIntegration &&
    wantsDiscoveryBook &&
    Boolean(config?.fields.some((f) => f.key === discoveryFieldKey));

  // Listen for Cal.com booking events posted from inside the iframe — no SDK required.
  useEffect(() => {
    if (!showSchedulingBlock) return;

    function handleMessage(event: MessageEvent) {
      const parsed = parseCalBookingMessage(event);
      if (!parsed) return;
      bookingHandlerRef.current?.(parsed.uid, parsed.videoCallUrl);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [showSchedulingBlock]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!embedKey || !csrfToken) return;
    if (submittingRef.current) return;

    setError(null);
    setFieldErrors({});

    if (config) {
      const emailErrors = collectEmailFieldErrors(config.fields, answers);
      if (Object.keys(emailErrors).length > 0) {
        setFieldErrors(emailErrors);
        setError("Please fix the highlighted fields and try again.");
        return;
      }
    }

    const mustSchedule = calIntegration && wantsDiscoveryBook;
    const hasMeeting = Boolean(meetingUrl.trim() || calBookingId.trim());
    if (mustSchedule && !hasMeeting && !schedulingSkipped) {
      setError(
        "Please complete scheduling, or check “I’m skipping scheduling”.",
      );
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await fetch(
        publicFormApiUrl(`/api/v1/forms/${encodeURIComponent(embedKey)}/submit`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csrfToken,
            answers,
            sourceUrl: window.location.href,
            sourceReferrer: document.referrer || null,
            utmJson: {},
            meetingUrl: meetingUrl.trim() || null,
            calBookingId: calBookingId.trim() || null,
            schedulingSkipped: mustSchedule ? schedulingSkipped : undefined,
            submittedAt: new Date().toISOString(),
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as SubmitErrorBody;
      if (!res.ok) {
        if (body.error === "validation_error") {
          const issues = asIssueArray(body.issues);
          if (issues.length > 0 && config) {
            const byKey: Record<string, string> = {};
            for (const i of issues) {
              if (byKey[i.key]) continue;
              const f = config.fields.find((x) => x.key === i.key);
              byKey[i.key] = issueToText(i, f);
            }
            setFieldErrors(byKey);
            setError("Please fix the highlighted fields and try again.");
            return;
          }
        }
        setError(body.message || body.error || "Submit failed.");
        return;
      }
      setDone(true);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-theme flex min-h-screen items-center justify-center bg-canvas text-neutral-400">
        Loading form…
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="admin-theme flex min-h-screen items-center justify-center bg-canvas px-4 text-center text-red-400">
        {error}
      </div>
    );
  }

  if (done) {
    return (
      <div className="admin-theme flex min-h-screen items-center justify-center bg-canvas px-4 text-center text-neutral-200">
        <div className="max-w-md rounded-2xl border border-white/10 bg-[#15191C] px-8 py-10 shadow-lg shadow-black/40">
          <p className="text-xl font-semibold text-white">Thank you</p>
          <p className="mt-2 text-sm text-neutral-400">
            Your response was received.
          </p>
        </div>
      </div>
    );
  }

  if (!config) return null;

  const sections = groupFieldsIntoSections(config.fields);
  const brand = config.settings?.brandLogoText?.trim() || config.name;
  const footer =
    config.settings?.footerAttribution?.trim() || "Powered by Sitropix";
  const mustSchedule = calIntegration && wantsDiscoveryBook;

  return (
    <div className="admin-theme min-h-screen bg-canvas px-4 py-10 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <span className="text-lg font-black tracking-tight text-brand-lime">
            {brand}
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#15191C] p-6 shadow-lg shadow-black/30 sm:p-8">
          <form className="space-y-10" onSubmit={onSubmit}>
            {sections.map((sec, _sectionIndex) => (
              <div key={sec.sectionKey}>
                {sec.sectionTitle ? (
                  <div className="mb-4">
                    {sec.sectionRequired ? (
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Required
                      </p>
                    ) : null}
                    <h2 className="text-base font-semibold text-white">
                      {sec.sectionTitle}
                    </h2>
                  </div>
                ) : null}

                <div className="space-y-6">
                  {layoutRows(sec.items).map((row, ri) => (
                    <div
                      key={`${sec.sectionKey}-r-${ri}`}
                      className={
                        row.length > 1 && getVj(row[0]).layout === "half"
                          ? "grid gap-4 sm:grid-cols-2"
                          : "grid gap-6"
                      }
                    >
                      {row.map((f) => (
                        <label key={f.key} className="block text-sm">
                          <span className="text-xs font-medium text-neutral-400">
                            {f.label}
                            {f.required ? (
                              <span className="text-red-400"> *</span>
                            ) : null}
                          </span>
                          {renderFieldControl(
                            f,
                            answers,
                            setAnswers,
                            fieldErrors,
                          )}
                          {fieldErrors[f.key] ? (
                            <p className="mt-1 text-xs text-red-400">
                              {fieldErrors[f.key]}
                            </p>
                          ) : null}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {showSchedulingBlock ? (
              <div className="border-t border-white/10 pt-8">
                <div className="mb-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Required
                  </p>
                  <h2 className="text-base font-semibold text-white">
                    Schedule your discovery call
                  </h2>
                  <p className="mt-1 text-xs text-neutral-400">
                    Pick a time below — your booking is captured automatically.
                  </p>
                </div>

                {calIframeUrl ? (
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                    <iframe
                      title="Schedule a discovery call"
                      src={calIframeUrl}
                      className="h-[min(660px,80vh)] w-full border-0"
                      allow="camera; microphone; fullscreen; payment"
                    />
                  </div>
                ) : null}

                {bookingConfirmed ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-brand-lime">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path
                        d="M20 6L9 17l-5-5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Booking confirmed — you can now finish the form.
                  </p>
                ) : (
                  <details className="mt-4 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-neutral-400">
                    <summary className="cursor-pointer font-medium text-neutral-300 hover:text-white">
                      Booked but not auto-detected? Paste details manually
                    </summary>
                    <p className="mt-2 text-neutral-500">
                      Paste the Cal booking UID or meeting link from your
                      confirmation email.
                    </p>
                    <input
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/50"
                      placeholder="Booking UID (from confirmation email)"
                      value={calBookingId}
                      onChange={(e) => {
                        setCalBookingId(e.target.value);
                        if (e.target.value.trim()) setBookingConfirmed(true);
                      }}
                    />
                    <input
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/50"
                      placeholder="https://cal.com/... (optional)"
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                    />
                  </details>
                )}
              </div>
            ) : null}

            {mustSchedule ? (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-white/20 accent-brand-lime"
                  checked={schedulingSkipped}
                  onChange={(e) => {
                    setSchedulingSkipped(e.target.checked);
                    if (e.target.checked) {
                      setBookingConfirmed(false);
                      setCalBookingId("");
                      setMeetingUrl("");
                    }
                  }}
                />
                <span>I’m skipping scheduling (no meeting booked)</span>
              </label>
            ) : null}

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-xs text-neutral-500 sm:flex-1">
                {footer}
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className={`rounded-lg bg-brand-lime px-8 py-3 text-sm font-bold text-canvas shadow-glow transition hover:brightness-110 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isSubmitting ? "Sending…" : "Finish"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
