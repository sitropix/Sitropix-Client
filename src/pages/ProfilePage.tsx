import { FormEvent, useEffect, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import { patchProfile, requestPasswordReset } from "@/services/authApi";
import { ApiRequestError, setAccessToken } from "@/services/http";
import { SxButton } from "@/components/sx/Button";
import { SxInput } from "@/components/sx/Input";
import { SxPageHeader } from "@/components/sx/PageHeader";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

export function ProfilePage() {
  const { contact, loading, error, refresh } = useUser();
  const { updateUser, user } = useAuth();
  const toast = useSxToast();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);

  useEffect(() => {
    document.title = "Account · Sitropix";
  }, []);

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
      toast.success("Account saved.");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setFormError(err.message || "Couldn't save your account.");
      } else {
        setFormError(err instanceof Error ? err.message : "Couldn't save your account.");
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
      toast.success(
        "Reset link sent.",
        `Check your inbox at ${emailToReset}.`,
      );
    } catch (err) {
      toast.error(
        "Couldn't send reset link.",
        err instanceof Error ? err.message : undefined,
      );
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div data-sx-root className="flex flex-col gap-6">
      <SxPageHeader
        title="Account"
        description="Update the email and phone number on this account."
        actions={
          <SxButton
            variant="secondary"
            size="sm"
            loading={refreshBusy}
            onClick={() => {
              if (refreshBusy) return;
              setRefreshBusy(true);
              void refresh().finally(() => setRefreshBusy(false));
            }}
          >
            {refreshBusy ? "Refreshing…" : "Refresh"}
          </SxButton>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sx-sm text-[var(--color-danger-fg)]"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-sx-lg" />
          <Skeleton className="h-48 rounded-sx-lg" />
        </div>
      ) : null}

      {!loading && contact ? (
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
                helpText="We'll send your invoice receipts here."
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
              Manage your password and security options.
            </p>
            <div className="mt-5 flex flex-col gap-3 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sx-sm font-medium text-[var(--text-primary)]">
                  Reset password
                </p>
                <p className="mt-1 text-sx-xs text-[var(--text-tertiary)]">
                  We'll send a reset link to your email.
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
