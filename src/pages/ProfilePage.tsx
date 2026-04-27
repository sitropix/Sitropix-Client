import { FormEvent, useEffect, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { patchProfile } from "@/services/authApi";
import { ApiRequestError, setAccessToken } from "@/services/http";

export function ProfilePage() {
  const { contact, loading, error, refresh } = useUser();
  const { updateUser } = useAuth();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/dashboard" }, { label: "Profile" }]} />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Profile</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">Update the email and mobile number for this account.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white transition hover:border-brand-lime/35"
        >
          Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>
      )}
      {formError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{formError}</div>
      )}
      {saved && !formError && (
        <div className="rounded-xl border border-brand-lime/30 bg-brand-lime/10 px-4 py-3 text-sm text-white">Profile saved.</div>
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
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-sm font-semibold text-white">Account</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-ink-subtle">Name</dt>
              <dd className="mt-1 font-medium text-white">
                {contact.firstName} {contact.lastName}
              </dd>
            </div>
          </dl>
          <form className="mt-6 space-y-4 border-t border-white/10 pt-6" onSubmit={(e) => void onSubmit(e)}>
            <div>
              <label htmlFor="profile-email" className="block text-xs font-medium uppercase tracking-wide text-ink-subtle">
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-2 w-full max-w-md rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
              />
            </div>
            <div>
              <label htmlFor="profile-phone" className="block text-xs font-medium uppercase tracking-wide text-ink-subtle">
                Mobile number
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="+1 …"
                className="mt-2 w-full max-w-md rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
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
      )}
    </div>
  );
}
