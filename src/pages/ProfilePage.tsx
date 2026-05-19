import { FormEvent, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { portal } from "@/components/portal/portalStyles";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { patchProfile, requestPasswordReset } from "@/services/authApi";
import { ApiRequestError, setAccessToken } from "@/services/http";

export function ProfilePage() {
  const { contact, loading, error, refresh } = useUser();
  const { updateUser, user } = useAuth();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [refreshBusy, setRefreshBusy] = useState(false);

  useEffect(() => {
    if (!contact) return;
    setEmail(contact.email);
    setPhone(contact.phoneNumber ?? "");
  }, [contact]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!contact) return;
    setFormError(null);
    setSaved(false);
    setSaving(true);
    try {
      const body: { email?: string; phoneNumber?: string } = {};
      const trimmedPhone = phone.trim();
      if (email.trim().toLowerCase() !== contact.email.toLowerCase()) body.email = email.trim();
      if (trimmedPhone !== (contact.phoneNumber ?? "")) body.phoneNumber = trimmedPhone || "";
      if (Object.keys(body).length === 0) {
        setSaved(true);
        return;
      }
      const res = await patchProfile(body);
      if (res.accessToken) setAccessToken(res.accessToken);
      updateUser(res.user);
      await refresh();
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message || "Could not save profile.");
      } else {
        setFormError(err instanceof Error ? err.message : "Could not save profile.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    const emailToReset = user?.email || contact?.email;
    if (!emailToReset) return;
    setResetLoading(true);
    setResetError(null);
    setResetSent(false);
    try {
      await requestPasswordReset(emailToReset);
      setResetSent(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Profile" }]} />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className={portal.pageTitle}>Profile</h1>
          <p className={portal.pageSubtitle}>Update the email and mobile number for this account.</p>
        </div>
        <button
          type="button"
          disabled={refreshBusy}
          aria-busy={refreshBusy}
          onClick={() => {
            if (refreshBusy) return;
            setRefreshBusy(true);
            void refresh().finally(() => setRefreshBusy(false));
          }}
          className={portal.btnSecondary + " !text-sm"}
        >
          {refreshBusy ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      )}
      {formError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{formError}</div>
      )}
      {saved && !formError && (
        <div className="rounded-xl border border-accent-gold/30 bg-gold-light px-4 py-3 font-body-sm text-body-sm text-on-secondary-container">
          Profile saved.
        </div>
      )}

      {loading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-6 w-48" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-6 w-32" />
          </div>
        </div>
      )}

      {!loading && contact && (
        <section className={portal.panel}>
          <h2 className="font-body font-semibold text-on-surface">Account</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-caption text-caption uppercase tracking-wide text-on-surface-variant">Name</dt>
              <dd className="mt-1 font-medium text-on-surface">
                {contact.firstName} {contact.lastName}
              </dd>
            </div>
          </dl>
          <form className="mt-6 space-y-4 border-t ink-border-10 pt-6" onSubmit={(e) => void onSubmit(e)}>
            <div>
              <label htmlFor="profile-email" className="block font-caption text-caption uppercase tracking-wide text-on-surface-variant">
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={"mt-2 max-w-md " + portal.input}
              />
            </div>
            <div>
              <label htmlFor="profile-phone" className="block font-caption text-caption uppercase tracking-wide text-on-surface-variant">
                Mobile number
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="+1 …"
                className={"mt-2 max-w-md " + portal.input}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className={portal.btnPrimary}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        </section>
      )}

      {!loading && contact && (
        <section className={portal.panel}>
          <h2 className="font-body font-semibold text-on-surface">Security</h2>
          <p className="mt-2 text-sm text-ink-muted">Manage your password and account security settings.</p>

          {resetError && (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {resetError}
            </div>
          )}
          {resetSent && (
            <div className="mt-4 rounded-xl border border-brand-lime/30 bg-brand-lime/10 px-4 py-3 text-sm text-white">
              Password reset email sent! Check your inbox for instructions.
            </div>
          )}

          <div className="mt-6 flex flex-col gap-4 rounded-xl border border-on-surface/10 bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-body-sm text-body-sm font-medium text-on-surface">Reset Password</p>
              <p className="mt-1 font-caption text-caption text-on-surface-variant">
                We'll send a password reset link to your email address.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handlePasswordReset()}
              disabled={resetLoading}
              className={portal.btnSecondary + " shrink-0 !text-sm"}
            >
              {resetLoading ? "Sending…" : "Send Reset Link"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
