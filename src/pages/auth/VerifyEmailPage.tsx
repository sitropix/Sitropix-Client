import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { verifyEmailWithToken } from "@/services/authApi";
import { ApiRequestError } from "@/services/http";
import { SxButton } from "@/components/sx/Button";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Verifying email · Sitropix";
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("err");
      setMessage("This verification link is missing its token. Request a new link from sign-in.");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    void verifyEmailWithToken(token)
      .then(() => {
        if (!cancelled) {
          setStatus("ok");
          setMessage("Your email is verified. Redirecting you to sign in.");
          setTimeout(() => navigate("/login"), 1500);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus("err");
          setMessage(
            err instanceof ApiRequestError && err.message === "invalid_token"
              ? "This verification link is invalid or has already been used."
              : "Verification failed. Request a new link from the sign-in screen.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Email verification
        </div>
        <h1 className="mt-2 font-display text-sx-2xl font-medium leading-tight text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)]">
          {status === "ok"
            ? "You're verified."
            : status === "err"
              ? "We couldn't verify that link."
              : "Confirming your email…"}
        </h1>
      </header>

      {status === "loading" ? (
        <div className="flex items-center gap-3 rounded-sx-md border border-[var(--color-info-500)]/30 bg-[var(--color-info-bg)] px-4 py-3 text-sx-sm text-[var(--color-info-fg)]">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-info-500)]/30 border-t-[var(--color-info-500)]"
            aria-hidden
          />
          Verifying your email…
        </div>
      ) : null}

      {status === "ok" && message ? (
        <div className="rounded-sx-md border border-[var(--color-success-500)]/30 bg-[var(--color-success-bg)] px-4 py-3 text-sx-sm text-[var(--color-success-fg)]">
          {message}
        </div>
      ) : null}

      {status === "err" && message ? (
        <div className="rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-4 py-3 text-sx-sm text-[var(--color-danger-fg)]">
          {message}
        </div>
      ) : null}

      <div>
        <Link to="/login">
          <SxButton variant="secondary">Go to sign in</SxButton>
        </Link>
      </div>
    </div>
  );
}
