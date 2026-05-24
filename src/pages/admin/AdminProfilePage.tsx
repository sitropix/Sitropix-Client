import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { patchProfile, requestPasswordReset } from "@/services/authApi";
import { ApiRequestError, setAccessToken } from "@/services/http";
import { SxButton } from "@/components/sx/Button";
import { SxInput } from "@/components/sx/Input";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

export function AdminProfilePage() {
  const { contact, loading, error, refresh } = useUser();
  const { updateUser, user } = useAuth();
  const toast = useSxToast();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (!contact) return;
    setEmail(contact.email);
    setPhone(contact.phoneNumber ?? "");
  }, [contact]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!contact) return;
    setFormError(null);
    setSaving(true);
    try {
      const body: { email?: string; phoneNumber?: string } = {};
      const trimmedPhone = phone.trim();
      if (email.trim().toLowerCase() !== contact.email.toLowerCase())
        body.email = email.trim();
      if (trimmedPhone !== (contact.phoneNumber ?? ""))
        body.phoneNumber = trimmedPhone || "";
      if (Object.keys(body).length === 0) {
        toast.info("Nothing to update.");
        return;
      }
      const res = await patchProfile(body);
      if (res.accessToken) setAccessToken(res.accessToken);
      updateUser(res.user);
      await refresh();
      toast.success("Profile saved.");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message || "Couldn't save your profile.");
      } else {
        setFormError(
          err instanceof Error ? err.message : "Couldn't save your profile.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    const emailToReset = user?.email || contact?.email;
    if (!emailToReset) return;
    setResetLoading(true);
    try {
      await requestPasswordReset(emailToReset);
      toast.success("Reset link sent.", `Check your inbox at ${emailToReset}.`);
    } catch (err) {
      toast.error(
        "Couldn't send reset link.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setResetLoading(false);
    }
  }

  const roleLabel = user?.role?.replace("_", " ") ?? "admin";

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Account
        </p>
        <h1 className="mt-1.5 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Profile
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          Your contact details and password.
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sx-sm text-[var(--color-danger-fg)]"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
      ) : contact ? (
        <>
          <SxPanel title="Account">
            <dl className="mb-5 grid gap-3 text-sx-sm">
              <div>
                <dt className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  Name
                </dt>
                <dd className="mt-1 font-medium text-[var(--text-primary)]">
                  {contact.firstName} {contact.lastName}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  Role
                </dt>
                <dd className="mt-1 font-medium capitalize text-[var(--text-primary)]">
                  {roleLabel}
                </dd>
              </div>
            </dl>
            <form
              className="flex flex-col gap-4 border-t border-[var(--border-subtle)] pt-5"
              onSubmit={(e) => void onSubmit(e)}
            >
              <SxInput
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                errorText={formError ?? undefined}
              />
              <SxInput
                label="Phone number"
                type="tel"
                autoComplete="tel"
                placeholder="+1 …"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div>
                <SxButton type="submit" loading={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </SxButton>
              </div>
            </form>
          </SxPanel>

          <SxPanel title="Security">
            <p className="text-sx-sm text-[var(--text-secondary)]">
              Reset your sign-in password via email.
            </p>
            <div className="mt-5 flex flex-col gap-3 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sx-sm font-medium text-[var(--text-primary)]">
                  Reset password
                </p>
                <p className="mt-1 text-sx-xs text-[var(--text-tertiary)]">
                  We'll send a reset link to your email on file.
                </p>
              </div>
              <SxButton
                variant="secondary"
                size="sm"
                loading={resetLoading}
                onClick={() => void handlePasswordReset()}
              >
                {resetLoading ? "Sending…" : "Send reset link"}
              </SxButton>
            </div>
          </SxPanel>
        </>
      ) : null}
    </div>
  );
}
