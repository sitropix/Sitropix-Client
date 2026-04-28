import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiRequestError } from "@/services/http";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState(true);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 401) setError("Invalid email or password.");
        else if (err.status === 503 || err.message === "database_unavailable")
          setError("Sign-in is temporarily unavailable. Try again in a moment.");
        else if (err.status >= 500) setError("Something went wrong on the server. Try again shortly.");
        else setError(err.message || "Sign-in failed");
      } else {
        setError("Could not reach the server. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#15191c] p-7 shadow-2xl shadow-black/40">
      <h1 className="text-3xl font-bold text-white">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-muted">Sign in to access your client portal.</p>

      <form className="mt-6 space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Email address
          </label>
          <input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            type="email"
            autoComplete="email"
            className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-white outline-none transition focus:border-brand-lime/35"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Password
            </label>
            <Link className="text-xs text-brand-lime hover:underline" to="/forgot-password">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-white outline-none transition focus:border-brand-lime/35"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            type="checkbox"
            className="h-4 w-4 rounded border-white/15 bg-black/30 accent-brand-lime"
          />
          Remember me for 30 days
        </label>

        {error && <p className="text-sm text-rose-200">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="relative w-full rounded-xl bg-brand-lime px-5 py-3 text-sm font-bold text-canvas transition hover:bg-brand-lime-dim disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Logging in…
            </span>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Don't have an account?{" "}
        <Link className="font-semibold text-brand-lime" to="/signup">
          Sign up
        </Link>
      </p>
    </div>
  );
}
