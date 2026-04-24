import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "@/services/authApi";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h1 className="text-xl font-semibold text-white">Reset password</h1>
      <p className="mt-1 text-sm text-ink-muted">We will email you a link if an account exists for this address.</p>
      {done ? (
        <p className="mt-4 text-sm text-emerald-200">
          If that email is registered, you will receive instructions shortly. Check your spam folder.
        </p>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            required
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas transition hover:bg-brand-lime-dim disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm text-ink-muted">
        <Link className="font-semibold text-brand-lime" to="/login">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
