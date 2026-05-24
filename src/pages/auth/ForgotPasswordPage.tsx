import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "@/services/authApi";
import { SxButton } from "@/components/sx/Button";
import { SxInput } from "@/components/sx/Input";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Reset password · Sitropix";
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setDone(true);
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
          Reset your password
        </h1>
        <p className="mt-3 text-sx-sm leading-relaxed text-[var(--text-secondary)]">
          Enter your email and we'll send you a link to set a new password.
        </p>
      </header>

      {done ? (
        <div className="rounded-sx-md border border-[var(--color-success-500)]/30 bg-[var(--color-success-bg)] px-4 py-3 text-sx-sm text-[var(--color-success-fg)]">
          If <strong>{email}</strong> is registered, the reset link is on its way. Check your inbox — and your spam folder if you don't see it within a few minutes.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <SxInput
            label="Email"
            type="email"
            placeholder="you@business.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <SxButton type="submit" size="lg" loading={submitting} fullWidth>
            {submitting ? "Sending…" : "Send reset link"}
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
