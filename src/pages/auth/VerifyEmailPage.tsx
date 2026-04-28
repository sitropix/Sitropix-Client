import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { verifyEmailWithToken } from "@/services/authApi";
import { ApiRequestError } from "@/services/http";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("err");
      setMessage("Missing verification token in the link.");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    void verifyEmailWithToken(token)
      .then(() => {
        if (!cancelled) {
          setStatus("ok");
          setMessage("Your email is verified. You can sign in.");
          setTimeout(() => navigate("/login"), 1600);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus("err");
          setMessage(
            err instanceof ApiRequestError && err.message === "invalid_token"
              ? "This link is invalid or has already been used."
              : "Verification failed. Request a new link from sign-in help if available.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h1 className="text-xl font-semibold text-white">Email verification</h1>
      <p className="mt-1 text-sm text-ink-muted">Confirming your address…</p>
      {status === "loading" && (
        <div className="mt-4 flex items-center gap-3">
          <svg
            className="h-5 w-5 animate-spin text-brand-lime"
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
          <p className="text-sm text-ink-muted">Verifying your email…</p>
        </div>
      )}
      {status === "ok" && <p className="mt-4 text-sm text-emerald-200">{message}</p>}
      {status === "err" && message && <p className="mt-4 text-sm text-rose-200">{message}</p>}
      <p className="mt-6 text-sm text-ink-muted">
        <Link className="font-semibold text-brand-lime" to="/login">
          Go to sign in
        </Link>
      </p>
    </div>
  );
}
