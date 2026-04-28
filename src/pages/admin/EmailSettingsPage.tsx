import { FormEvent, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  clearAdminEmailSettings,
  fetchAdminEmailSettings,
  postAdminEmailTest,
  saveAdminEmailSettings,
} from "@/services/subscriptionsApi";
import { ApiRequestError, isModuleForbiddenError } from "@/services/http";
import type { EmailProviderId, EmailSettingsPayload } from "@/types/subscription";

const PROVIDERS: { id: EmailProviderId; label: string }[] = [
  { id: "console", label: "Console only (log, no delivery)" },
  { id: "smtp", label: "SMTP" },
  { id: "brevo", label: "Brevo (API)" },
  { id: "mailgun", label: "Mailgun (API)" },
  { id: "resend", label: "Resend (API)" },
  { id: "sendgrid", label: "SendGrid (API)" },
];

export function EmailSettingsPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const [payload, setPayload] = useState<EmailSettingsPayload | null>(null);
  const [provider, setProvider] = useState<EmailProviderId>("console");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [brevoKey, setBrevoKey] = useState("");
  const [mailgunDomain, setMailgunDomain] = useState("");
  const [mailgunRegion, setMailgunRegion] = useState<"us" | "eu">("us");
  const [mailgunKey, setMailgunKey] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [sendgridKey, setSendgridKey] = useState("");
  const [testTo, setTestTo] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noModuleAccess, setNoModuleAccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  async function load() {
    setLoading(!payload);
    setNoModuleAccess(false);
    try {
      const p = await fetchAdminEmailSettings();
      setPayload(p);
      updateCache({ emailSettings: p });
      setProvider(p.provider as EmailProviderId);
      setFromEmail(p.fromEmail);
      setFromName(p.fromName ?? "");
      const s = p.settings ?? {};
      setSmtpHost(String(s.smtpHost ?? ""));
      setSmtpPort(String(s.smtpPort ?? 587));
      setSmtpSecure(Boolean(s.smtpSecure));
      setSmtpUser(String(s.smtpUser ?? ""));
      setMailgunDomain(String(s.mailgunDomain ?? ""));
      setMailgunRegion(s.mailgunRegion === "eu" ? "eu" : "us");
    } catch (err) {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
      } else {
        setNotice("Could not load email settings.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cache.emailSettings) {
      const p = cache.emailSettings;
      setPayload(p);
      setProvider(p.provider as EmailProviderId);
      setFromEmail(p.fromEmail);
      setFromName(p.fromName ?? "");
      const s = p.settings ?? {};
      setSmtpHost(String(s.smtpHost ?? ""));
      setSmtpPort(String(s.smtpPort ?? 587));
      setSmtpSecure(Boolean(s.smtpSecure));
      setSmtpUser(String(s.smtpUser ?? ""));
      setMailgunDomain(String(s.mailgunDomain ?? ""));
      setMailgunRegion(s.mailgunRegion === "eu" ? "eu" : "us");
      setLoading(false);
      return;
    }
    void load();
  }, []);

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Email Settings" />;
  }

  function buildSettings(): Record<string, unknown> {
    if (provider === "smtp") {
      return {
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort) || 587,
        smtpSecure,
        smtpUser: smtpUser.trim(),
      };
    }
    if (provider === "mailgun") {
      return { mailgunDomain: mailgunDomain.trim(), mailgunRegion };
    }
    return {};
  }

  function buildSecrets(): Record<string, string> {
    const o: Record<string, string> = {};
    if (provider === "smtp" && smtpPassword.trim()) o.smtpPassword = smtpPassword.trim();
    if (provider === "brevo" && brevoKey.trim()) o.brevoApiKey = brevoKey.trim();
    if (provider === "mailgun" && mailgunKey.trim()) o.mailgunApiKey = mailgunKey.trim();
    if (provider === "resend" && resendKey.trim()) o.resendApiKey = resendKey.trim();
    if (provider === "sendgrid" && sendgridKey.trim()) o.sendgridApiKey = sendgridKey.trim();
    return o;
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    const secrets = buildSecrets();
    if (provider !== "console" && provider !== "smtp" && Object.keys(secrets).length === 0) {
      const masks = payload?.secretMasks ?? {};
      const hasAny = Object.keys(masks).some((k) => masks[k] && !String(masks[k]).startsWith("_"));
      if (!hasAny) {
        setNotice("Enter the API key (or other secret) for this provider, or it cannot send mail.");
        return;
      }
    }
    if (provider === "smtp" && (!smtpHost.trim() || !smtpUser.trim())) {
      setNotice("SMTP requires host and username.");
      return;
    }
    if (provider === "smtp" && !smtpPassword.trim()) {
      const m = payload?.secretMasks?.smtpPassword;
      if (!m) {
        setNotice("SMTP requires a password (or leave blank only when updating an existing password).");
        return;
      }
    }
    if (provider === "mailgun" && !mailgunDomain.trim()) {
      setNotice("Mailgun requires sending domain.");
      return;
    }
    setSaving(true);
    try {
      await saveAdminEmailSettings({
        provider,
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
        settings: buildSettings(),
        secrets,
      });
      setSmtpPassword("");
      setBrevoKey("");
      setMailgunKey("");
      setResendKey("");
      setSendgridKey("");
      setNotice("Saved. Outbound mail will use these settings.");
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.message === "secrets_key_required") {
        setNotice("Server must set EMAIL_SECRETS_KEY (16+ chars) before saving credentials.");
      } else if (err instanceof ApiRequestError) {
        setNotice(err.message || "Save failed");
      } else {
        setNotice("Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setNotice(null);
    setTesting(true);
    try {
      const r = await postAdminEmailTest(testTo.trim() || undefined);
      setNotice(`Test sent to ${r.to}.`);
    } catch {
      setNotice("Test send failed. Check provider settings and server logs.");
    } finally {
      setTesting(false);
    }
  }

  async function onClearDb() {
    setClearing(true);
    try {
      await clearAdminEmailSettings();
      await load();
      setNotice("Database email settings removed. Using .env until you save again.");
    } catch {
      setNotice("Could not clear settings.");
    } finally {
      setClearing(false);
      setClearConfirmOpen(false);
    }
  }

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Admin" }, { label: "Email delivery" }]} />
      <header>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Email delivery</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Only administrators can change this. Secrets are encrypted at rest using <code className="text-brand-lime">EMAIL_SECRETS_KEY</code> on the API
          server. Leave API key / password fields empty to keep the current value.
        </p>
      </header>

      {loading && <p className="text-sm text-ink-muted">Loading…</p>}
      {payload?.hint && <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-ink-muted">{payload.hint}</p>}
      {notice && <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/90">{notice}</p>}

      {!loading && payload && (
        <form className="space-y-6" onSubmit={onSave}>
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-sm font-semibold text-white">Provider</h2>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as EmailProviderId)}
              className="mt-3 w-full max-w-md rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {payload.configuredInDatabase && (
              <p className="mt-2 text-xs text-ink-subtle">Stored in database (overrides .env for this app).</p>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-sm font-semibold text-white">From address</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                type="email"
                required
                placeholder="noreply@yourdomain.com"
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
              />
              <input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Display name (optional)"
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
              />
            </div>
          </section>

          {provider === "smtp" && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-sm font-semibold text-white">SMTP</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="Host"
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                />
                <input
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="Port"
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                />
                <input
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="Username"
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                />
                <input
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  type="password"
                  placeholder={payload.secretMasks?.smtpPassword ? `Password (${payload.secretMasks.smtpPassword})` : "Password"}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                />
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
                <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} className="accent-brand-lime" />
                TLS (secure) — e.g. port 465
              </label>
            </section>
          )}

          {provider === "brevo" && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-sm font-semibold text-white">Brevo</h2>
              <input
                value={brevoKey}
                onChange={(e) => setBrevoKey(e.target.value)}
                type="password"
                placeholder={payload.secretMasks?.brevoApiKey ? `API key (${payload.secretMasks.brevoApiKey})` : "API key (xkeysib-…)"}
                className="mt-3 w-full max-w-xl rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
              />
            </section>
          )}

          {provider === "mailgun" && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-sm font-semibold text-white">Mailgun</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  value={mailgunDomain}
                  onChange={(e) => setMailgunDomain(e.target.value)}
                  placeholder="Sending domain (mg.example.com)"
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                />
                <select
                  value={mailgunRegion}
                  onChange={(e) => setMailgunRegion(e.target.value as "us" | "eu")}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                >
                  <option value="us">US region</option>
                  <option value="eu">EU region</option>
                </select>
                <input
                  value={mailgunKey}
                  onChange={(e) => setMailgunKey(e.target.value)}
                  type="password"
                  placeholder={payload.secretMasks?.mailgunApiKey ? `Private API key (${payload.secretMasks.mailgunApiKey})` : "Private API key"}
                  className="md:col-span-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                />
              </div>
            </section>
          )}

          {provider === "resend" && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-sm font-semibold text-white">Resend</h2>
              <input
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
                type="password"
                placeholder={payload.secretMasks?.resendApiKey ? `API key (${payload.secretMasks.resendApiKey})` : "API key"}
                className="mt-3 w-full max-w-xl rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
              />
            </section>
          )}

          {provider === "sendgrid" && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-sm font-semibold text-white">SendGrid</h2>
              <input
                value={sendgridKey}
                onChange={(e) => setSendgridKey(e.target.value)}
                type="password"
                placeholder={payload.secretMasks?.sendgridApiKey ? `API key (${payload.secretMasks.sendgridApiKey})` : "API key"}
                className="mt-3 w-full max-w-xl rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
              />
            </section>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-full bg-brand-lime px-6 py-2.5 text-sm font-semibold text-canvas transition hover:bg-brand-lime-dim disabled:opacity-50"
            >
              {saving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {saving ? "Saving..." : "Save settings"}
            </button>
            <button
              type="button"
              disabled={testing}
              onClick={() => void onTest()}
              className="flex items-center gap-2 rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-white transition hover:border-brand-lime/35 disabled:opacity-50"
            >
              {testing && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {testing ? "Sending..." : "Send test email"}
            </button>
            {payload.configuredInDatabase && (
              <button
                type="button"
                disabled={clearing}
                onClick={() => setClearConfirmOpen(true)}
                className="flex items-center gap-2 rounded-full border border-rose-500/30 px-6 py-2.5 text-sm font-medium text-rose-100 transition hover:bg-rose-500/10 disabled:opacity-50"
              >
                Clear DB settings
              </button>
            )}
          </div>
          <div className="flex max-w-md flex-col gap-2">
            <label className="text-xs text-ink-muted">Test recipient (optional — defaults to your admin email)</label>
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              type="email"
              placeholder="you@company.com"
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
            />
          </div>
        </form>
      )}

      <ConfirmDialog
        open={clearConfirmOpen}
        title="Clear database settings"
        description="Remove email settings from database and fall back to environment variables? This cannot be undone."
        confirmLabel="Clear settings"
        variant="danger"
        loading={clearing}
        onConfirm={() => void onClearDb()}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </div>
  );
}
