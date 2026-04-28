import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

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
    calIntegration?: boolean;
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
      if (typeof r.key !== "string" || typeof r.message !== "string") return null;
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
      if ((field?.type === "phone" || field?.type === "tel") && vj.strictE164 === true) {
        return `Please enter ${name} with country code (E.164), e.g. +919876543210.`;
      }
      return `Please enter ${name} in the expected format.`;
    case "min_value":
      return min != null ? `${name} must be at least ${min}.` : `${name} is below the minimum value.`;
    case "max_value":
      return max != null ? `${name} must be at most ${max}.` : `${name} is above the maximum value.`;
    default:
      return `Please check ${name}.`;
  }
}

export function PublicEmbedFormPage() {
  const { embedKey } = useParams<{ embedKey: string }>();
  const [config, setConfig] = useState<FormConfigResponse | null>(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [meetingUrl, setMeetingUrl] = useState("");
  const [calBookingId, setCalBookingId] = useState("");
  const [schedulingSkipped, setSchedulingSkipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!embedKey) return;
    setLoading(true);
    fetch(`/api/forms/${encodeURIComponent(embedKey)}/config`)
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
      })
      .catch(() => setError("Could not load form."))
      .finally(() => setLoading(false));
  }, [embedKey]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!embedKey || !csrfToken) return;
    setError(null);
    setFieldErrors({});

    const calIntegration = Boolean(config?.settings?.calIntegration);
    const hasMeeting = Boolean(meetingUrl.trim() || calBookingId.trim());
    if (calIntegration && !hasMeeting && !schedulingSkipped) {
      setError("Complete scheduling or check “I’m skipping scheduling”.");
      return;
    }

    const res = await fetch(`/api/v1/forms/${encodeURIComponent(embedKey)}/submit`, {
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
        schedulingSkipped: calIntegration ? schedulingSkipped : undefined,
        submittedAt: new Date().toISOString(),
      }),
    });
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
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">
        Loading form…
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-center text-red-400">
        {error}
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-center text-zinc-200">
        <div>
          <p className="text-xl font-semibold text-white">Thank you</p>
          <p className="mt-2 text-sm text-zinc-400">Your response was received.</p>
        </div>
      </div>
    );
  }

  if (!config) return null;

  const calUrl = config.settings?.calEmbedUrl?.trim();
  const calIntegration = Boolean(config.settings?.calIntegration);

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold text-white">{config.name}</h1>
        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          {config.fields
            .filter((f) => f.type !== "hidden")
            .map((f) => {
              const vj = getVj(f);
              const placeholder = strAttr(vj.placeholder);
              const numMin = numAttr(vj.min);
              const numMax = numAttr(vj.max);
              const numStep = numAttr(vj.step);

              return (
              <label key={f.key} className="block text-sm">
                <span className="text-zinc-400">
                  {f.label}
                  {f.required ? <span className="text-red-400"> *</span> : null}
                </span>
                {f.type === "textarea" ? (
                  <textarea
                    required={f.required}
                    placeholder={placeholder}
                    className={`mt-1 w-full rounded-lg border bg-zinc-900 px-3 py-2 text-white outline-none focus:border-lime-400 ${
                      fieldErrors[f.key] ? "border-red-500/70" : "border-white/10"
                    }`}
                    rows={4}
                    value={(answers[f.key] as string) ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
                  />
                ) : f.type === "select" ? (
                  <select
                    required={f.required}
                    className={`mt-1 w-full rounded-lg border bg-zinc-900 px-3 py-2 text-white outline-none focus:border-lime-400 ${
                      fieldErrors[f.key] ? "border-red-500/70" : "border-white/10"
                    }`}
                    value={(answers[f.key] as string) ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
                  >
                    <option value="">Choose…</option>
                    {(Array.isArray(f.optionsJson) ? f.optionsJson : []).map((opt) => (
                      <option key={String(opt)} value={String(opt)}>
                        {String(opt)}
                      </option>
                    ))}
                  </select>
                ) : f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    className="mt-2 h-4 w-4 accent-lime-400"
                    checked={Boolean(answers[f.key])}
                    onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.checked }))}
                  />
                ) : f.type === "date" ? (
                  <input
                    type="date"
                    required={f.required}
                    className={`mt-1 w-full rounded-lg border bg-zinc-900 px-3 py-2 text-white outline-none focus:border-lime-400 ${
                      fieldErrors[f.key] ? "border-red-500/70" : "border-white/10"
                    }`}
                    value={(answers[f.key] as string) ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
                  />
                ) : f.type === "file" ? (
                  <input
                    type="file"
                    required={f.required}
                    className={`mt-1 w-full text-sm ${fieldErrors[f.key] ? "text-red-300" : "text-zinc-300"}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        setAnswers((a) => ({ ...a, [f.key]: "" }));
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const r = String(reader.result ?? "");
                        const b64 = r.includes("base64,") ? r.split("base64,")[1] ?? "" : r;
                        setAnswers((a) => ({ ...a, [f.key]: b64 }));
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                ) : (
                  <input
                    required={f.required}
                    type={
                      f.type === "email"
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
                    className={`mt-1 w-full rounded-lg border bg-zinc-900 px-3 py-2 text-white outline-none focus:border-lime-400 ${
                      fieldErrors[f.key] ? "border-red-500/70" : "border-white/10"
                    }`}
                    value={(answers[f.key] as string) ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
                  />
                )}
                {fieldErrors[f.key] ? <p className="mt-1 text-xs text-red-400">{fieldErrors[f.key]}</p> : null}
              </label>
              );
            })}

          {calUrl ? (
            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {calIntegration ? "Schedule" : "Schedule (optional)"}
              </p>
              <div className="mt-3 aspect-video w-full overflow-hidden rounded-lg bg-black">
                <iframe title="Scheduling" src={calUrl} className="h-full min-h-[420px] w-full border-0" />
              </div>
            </div>
          ) : null}

          {calIntegration ? (
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                className="h-4 w-4 accent-lime-400"
                checked={schedulingSkipped}
                onChange={(e) => setSchedulingSkipped(e.target.checked)}
              />
              I’m skipping scheduling (no meeting booked)
            </label>
          ) : null}

          <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
            <p className="text-xs text-zinc-400">
              If you booked a meeting, paste your confirmation link (Cal.com HTTPS).
            </p>
            <input
              className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
              placeholder="https://cal.com/..."
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
            />
            <input
              className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
              placeholder="Optional Cal booking ID"
              value={calBookingId}
              onChange={(e) => setCalBookingId(e.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            className="w-full rounded-lg bg-lime-400 py-3 text-sm font-bold text-zinc-950 hover:bg-lime-300"
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}
