import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordWithToken } from "@/services/authApi";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token.trim()) {
      setError("Invalid or missing reset link.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPasswordWithToken(token, password);
      setDone(true);
      setTimeout(() => navigate("/login"), 1200);
    } catch {
      setError("This link may have expired, or the password does not meet requirements.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h1 className="text-xl font-semibold text-white">Set new password</h1>
      <p className="mt-1 text-sm text-ink-muted">Choose a strong password you have not used elsewhere.</p>
      {!token && <p className="mt-4 text-sm text-rose-200">Missing token in link. Request a new reset email.</p>}
      {done ? (
        <p className="mt-4 text-sm text-brand-lime">Password updated. Redirecting to sign in…</p>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          {error && <p className="text-sm text-rose-200">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !token}
            className="w-full rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas transition hover:bg-brand-lime-dim disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Update password"}
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
