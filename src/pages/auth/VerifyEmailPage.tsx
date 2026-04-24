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
      {status === "loading" && <p className="mt-4 text-sm text-ink-muted">Please wait.</p>}
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
