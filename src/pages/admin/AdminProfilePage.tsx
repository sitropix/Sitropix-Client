import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { patchProfile, requestPasswordReset } from "@/services/authApi";
import { ApiRequestError, setAccessToken } from "@/services/http";
import { Skeleton } from "@/components/Skeleton";

export function AdminProfilePage() {
  const { user, updateUser } = useAuth();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email);
    setPhone(user.phoneNumber ?? "");
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setFormError(null);
    setSaved(false);
    setSaving(true);
    try {
      const body: { email?: string; phoneNumber?: string } = {};
      const trimmedPhone = phone.trim();
      if (email.trim().toLowerCase() !== user.email.toLowerCase()) body.email = email.trim();
      if (trimmedPhone !== (user.phoneNumber ?? "")) body.phoneNumber = trimmedPhone || "";
      if (Object.keys(body).length === 0) {
        setSaved(true);
        return;
      }
      const res = await patchProfile(body);
      if (res.accessToken) setAccessToken(res.accessToken);
      updateUser(res.user);
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
    if (!user?.email) return;
    setResetLoading(true);
    setResetError(null);
    setResetSent(false);
    try {
      await requestPasswordReset(user.email);
      setResetSent(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setResetLoading(false);
    }
  }

  const displayName = user?.name || "Admin";
  const roleLabel = user?.role?.replace("_", " ") || "Admin";
  const initials = displayName
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "A";

  if (!user) {
    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-black tracking-tight text-white">Profile</h1>
        </header>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 opacity-0 animate-fade-up [animation-fill-mode:forwards]">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-lime">Account</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Profile</h1>
        <p className="mt-2 text-sm text-ink-muted">Manage your admin account settings and security.</p>
      </header>

      {formError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{formError}</div>
      )}
      {saved && !formError && (
        <div className="rounded-xl border border-brand-lime/30 bg-brand-lime/10 px-4 py-3 text-sm text-white">Profile saved successfully.</div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-[#0f1419] to-[#0b0f14] p-6 shadow-glass ring-1 ring-white/[0.05]">
          <div className="flex flex-col items-center text-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-brand-lime/40 to-brand-lime/20 text-2xl font-bold text-canvas shadow-[0_0_24px_rgba(132,204,22,0.3)]">
              {initials}
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">{displayName}</h2>
            <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
            <span className="mt-3 inline-flex rounded-full border border-brand-lime/30 bg-brand-lime/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-lime">
              {roleLabel}
            </span>
          </div>
          <dl className="mt-6 space-y-3 border-t border-white/10 pt-6 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-subtle">Email Verified</dt>
              <dd className={user.isEmailVerified ? "text-emerald-400" : "text-amber-400"}>
                {user.isEmailVerified ? "Yes" : "No"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-subtle">Phone</dt>
              <dd className="text-white">{user.phoneNumber || "Not set"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0c1016]/95 p-6 shadow-glass ring-1 ring-white/[0.04] lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Account Details</h2>
          <form className="mt-6 space-y-5" onSubmit={(e) => void onSubmit(e)}>
            <div>
              <label htmlFor="admin-name" className="block text-xs font-medium uppercase tracking-wide text-ink-subtle">
                Name
              </label>
              <input
                id="admin-name"
                type="text"
                value={user.name}
                disabled
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-ink-muted cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-ink-subtle">Contact support to change your name.</p>
            </div>
            <div>
              <label htmlFor="admin-email" className="block text-xs font-medium uppercase tracking-wide text-ink-subtle">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
              />
            </div>
            <div>
              <label htmlFor="admin-phone" className="block text-xs font-medium uppercase tracking-wide text-ink-subtle">
                Mobile number
              </label>
              <input
                id="admin-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="+1 …"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas transition hover:bg-brand-lime-dim disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#0c1016]/95 p-6 shadow-glass ring-1 ring-white/[0.04]">
        <h2 className="text-sm font-semibold text-white">Security</h2>
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

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/10 bg-black/20 p-4">
          <div>
            <p className="text-sm font-medium text-white">Reset Password</p>
            <p className="mt-1 text-xs text-ink-muted">
              We'll send a password reset link to your email address.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handlePasswordReset()}
            disabled={resetLoading}
            className="shrink-0 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:border-brand-lime/35 hover:bg-white/[0.07] disabled:opacity-50"
          >
            {resetLoading ? "Sending…" : "Send Reset Link"}
          </button>
        </div>
      </section>
    </div>
  );
}
