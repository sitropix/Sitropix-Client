import { FormEvent, useEffect, useState } from "react";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import {
  clearAdminEmailSettings,
  fetchAdminEmailSettings,
  postAdminEmailTest,
  saveAdminEmailSettings,
} from "@/services/subscriptionsApi";
import type { EmailProviderId, EmailSettingsPayload } from "@/types/subscription";
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxConfirmDialog } from "@/components/sx/ConfirmDialog";
import { SxInput, SxSelect } from "@/components/sx/Input";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

const PROVIDERS: { id: EmailProviderId; label: string; needsApiKey: boolean; needsSmtp: boolean }[] = [
  { id: "console", label: "Console (logs only — no email sent)", needsApiKey: false, needsSmtp: false },
  { id: "smtp", label: "SMTP", needsApiKey: false, needsSmtp: true },
  { id: "brevo", label: "Brevo (Sendinblue)", needsApiKey: true, needsSmtp: false },
  { id: "mailgun", label: "Mailgun", needsApiKey: true, needsSmtp: false },
  { id: "resend", label: "Resend", needsApiKey: true, needsSmtp: false },
  { id: "sendgrid", label: "SendGrid", needsApiKey: true, needsSmtp: false },
];

export function EmailSettingsPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const toast = useSxToast();
  const [payload, setPayload] = useState<EmailSettingsPayload | null>(
    cache.emailSettings ?? null,
  );
  const [loading, setLoading] = useState(!cache.emailSettings);

  const [provider, setProvider] = useState<EmailProviderId>("console");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpDomain, setSmtpDomain] = useState("");

  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  function hydrateForm(p: EmailSettingsPayload) {
    setProvider((p.provider as EmailProviderId) || "console");
    setFromEmail(p.fromEmail || "");
    setFromName(p.fromName || "");
    // Backend stores provider-specific keys (smtpHost, smtpPort, smtpUser, mailgunDomain).
    // Older saves may have used generic names (host/port/user/domain) — fall back to those too so
    // existing rows still hydrate cleanly.
    const s = (p.settings || {}) as Record<string, unknown>;
    setSmtpHost(String(s.smtpHost ?? s.host ?? ""));
    setSmtpPort(String(s.smtpPort ?? s.port ?? "587"));
    setSmtpUser(String(s.smtpUser ?? s.user ?? ""));
    setSmtpDomain(String(s.mailgunDomain ?? s.domain ?? ""));
    setApiKey("");
    setSmtpPass("");
  }

  useEffect(() => {
    if (payload) hydrateForm(payload);
  }, [payload]);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminEmailSettings()
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        updateCache({ emailSettings: data });
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load email settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const meta = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!fromEmail.trim()) {
      toast.warning("Add a from-email first.");
      return;
    }
    setSaving(true);
    try {
      const settings: Record<string, unknown> = {};
      const secrets: Record<string, string> = {};
      if (meta.needsSmtp) {
        settings.smtpHost = smtpHost.trim();
        settings.smtpPort = Number(smtpPort) || 587;
        if (smtpUser.trim()) settings.smtpUser = smtpUser.trim();
        if (smtpPass.trim()) secrets.smtpPassword = smtpPass.trim();
      }
      if (meta.needsApiKey && apiKey.trim()) {
        const k = apiKey.trim();
        // Each provider has its own allowed secret-key name; sending the wrong one is dropped server-side.
        if (provider === "brevo") secrets.brevoApiKey = k;
        else if (provider === "resend") secrets.resendApiKey = k;
        else if (provider === "sendgrid") secrets.sendgridApiKey = k;
        else if (provider === "mailgun") secrets.mailgunApiKey = k;
      }
      if (provider === "mailgun" && smtpDomain.trim()) {
        settings.mailgunDomain = smtpDomain.trim();
      }
      const next = await saveAdminEmailSettings({
        provider,
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim() || undefined,
        settings: Object.keys(settings).length ? settings : undefined,
        secrets: Object.keys(secrets).length ? secrets : undefined,
      });
      setPayload(next);
      updateCache({ emailSettings: next });
      toast.success("Email settings saved.");
    } catch (err) {
      toast.error(
        "Couldn't save settings.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    try {
      const r = await postAdminEmailTest(testTo.trim() || undefined);
      toast.success("Test email queued.", `Sent to ${r.to}.`);
    } catch (err) {
      toast.error(
        "Test failed.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setTesting(false);
    }
  }

  async function onClear() {
    setClearing(true);
    try {
      const next = await clearAdminEmailSettings();
      setPayload(next);
      updateCache({ emailSettings: next });
      hydrateForm(next);
      toast.success("Reset to console provider.");
      setClearOpen(false);
    } catch (err) {
      toast.error(
        "Reset failed.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Settings
        </p>
        <h1 className="mt-1.5 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Email
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          Pick the delivery service for transactional and ticket-reply emails.
          {payload?.hint ? (
            <span className="ml-1 text-[var(--text-tertiary)]">{payload.hint}</span>
          ) : null}
        </p>
      </header>

      {loading ? (
        <p className="text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
      ) : (
        <>
          <SxPanel
            title="Provider"
            action={
              payload ? (
                <SxBadge
                  variant={payload.configuredInDatabase ? "info" : "neutral"}
                  withDot={false}
                >
                  {payload.configuredInDatabase ? "DB-managed" : "from env"}
                </SxBadge>
              ) : null
            }
          >
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => void onSave(e)}
            >
              <SxSelect
                label="Service"
                value={provider}
                onChange={(e) => setProvider(e.target.value as EmailProviderId)}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </SxSelect>

              <div className="grid gap-4 sm:grid-cols-2">
                <SxInput
                  label="From email"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="hello@sitropix.com"
                  required
                />
                <SxInput
                  label="From name"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Sitropix Support"
                />
              </div>

              {meta.needsApiKey ? (
                <SxInput
                  label="API key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={(() => {
                    const masks = payload?.secretMasks ?? {};
                    const key =
                      provider === "brevo"
                        ? masks.brevoApiKey
                        : provider === "resend"
                        ? masks.resendApiKey
                        : provider === "sendgrid"
                        ? masks.sendgridApiKey
                        : provider === "mailgun"
                        ? masks.mailgunApiKey
                        : masks.apiKey;
                    return key ? `Saved: ${key}` : "Paste your API key";
                  })()}
                  helpText="Leave blank to keep the existing key."
                />
              ) : null}

              {meta.needsSmtp ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <SxInput
                    label="SMTP host"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.sendgrid.net"
                  />
                  <SxInput
                    label="SMTP port"
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                  />
                  <SxInput
                    label="SMTP user"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                  />
                  <SxInput
                    label="SMTP password"
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder={
                      payload?.secretMasks?.pass
                        ? `Saved: ${payload.secretMasks.pass}`
                        : "Paste password"
                    }
                    helpText="Leave blank to keep the existing password."
                  />
                </div>
              ) : null}

              {provider === "mailgun" ? (
                <SxInput
                  label="Mailgun domain"
                  value={smtpDomain}
                  onChange={(e) => setSmtpDomain(e.target.value)}
                  placeholder="mg.sitropix.com"
                />
              ) : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <SxButton type="submit" loading={saving}>
                  Save settings
                </SxButton>
                <SxButton
                  type="button"
                  variant="ghost"
                  onClick={() => setClearOpen(true)}
                  className="!text-[var(--color-danger-fg)]"
                >
                  Reset to default
                </SxButton>
              </div>
            </form>
          </SxPanel>

          <SxPanel title="Send a test email">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <SxInput
                label="Send to"
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="(your account email by default)"
                containerClassName="flex-1"
              />
              <SxButton
                variant="secondary"
                onClick={() => void onTest()}
                loading={testing}
              >
                Send test
              </SxButton>
            </div>
            <p className="mt-3 text-sx-xs text-[var(--text-tertiary)]">
              On console provider, the test is logged server-side instead of sent.
            </p>
          </SxPanel>
        </>
      )}

      <SxConfirmDialog
        open={clearOpen}
        title="Reset email settings?"
        body="The provider goes back to console (logs only — no email delivery). Saved API keys are erased."
        confirmLabel="Reset"
        destructive
        loading={clearing}
        onConfirm={() => void onClear()}
        onCancel={() => !clearing && setClearOpen(false)}
      />
    </div>
  );
}
