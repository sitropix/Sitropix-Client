import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordWithToken } from "@/services/authApi";
import { SxButton } from "@/components/sx/Button";
import { SxInput } from "@/components/sx/Input";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Set new password · Sitropix";
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token.trim()) {
      setError("This reset link is missing its token. Request a new email.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPasswordWithToken(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 1200);
    } catch {
      setError(
        "This link may have expired, or the password didn't meet requirements (at least 8 characters).",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Password reset
        </div>
        <h1 className="mt-2 font-display text-sx-2xl font-medium leading-tight text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)]">
          Set a new password
        </h1>
        <p className="mt-3 text-sx-sm leading-relaxed text-[var(--text-secondary)]">
          Pick a strong password you haven't used elsewhere.
        </p>
      </header>

      {!token ? (
        <div className="rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sx-sm text-[var(--color-danger-fg)]">
          This reset link is missing its token. Request a new one from the
          <Link to="/forgot-password" className="ml-1 font-semibold underline">
            forgot password page
          </Link>
          .
        </div>
      ) : null}

      {done ? (
        <div className="rounded-sx-md border border-[var(--color-success-500)]/30 bg-[var(--color-success-bg)] px-4 py-3 text-sx-sm text-[var(--color-success-fg)]">
          Password updated. Redirecting to sign in…
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <SxInput
            label="New password"
            type="password"
            placeholder="••••••••"
            helpText="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            errorText={error ?? undefined}
          />
          <SxButton type="submit" size="lg" loading={submitting} disabled={!token} fullWidth>
            {submitting ? "Saving…" : "Update password"}
          </SxButton>
        </form>
      )}

      <p className="text-sx-sm text-[var(--text-secondary)]">
        <Link
          to="/login"
          className="font-semibold text-[var(--text-brand)] hover:underline"
        >
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
