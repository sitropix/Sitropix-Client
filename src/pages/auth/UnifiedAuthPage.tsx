import { adminHomePath } from "@/lib/adminAccess";
import { useAuth } from "@/context/AuthContext";
import { fetchInviteInfo, type InviteInfoResponse } from "@/services/authApi";
import { ApiRequestError } from "@/services/http";
import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { SxButton } from "@/components/sx/Button";
import { SxInput } from "@/components/sx/Input";
import { SxSegmentedControl } from "@/components/sx/SegmentedControl";
import { SxBadge } from "@/components/sx/Badge";

type AuthMode = "signin" | "signup";

function getSignupErrorMessage(err: unknown): string {
  if (!(err instanceof ApiRequestError)) {
    return "Couldn't create your account. Please try again.";
  }
  switch (err.code) {
    case "email_taken":
      return "An account already exists with this email. Sign in instead.";
    case "invite_email_mismatch":
      return "This invite is tied to a different email address. Use the invited email to continue.";
    case "invite_invalid":
      return "This invitation link is invalid or has expired. Ask your team to send a new one.";
    case "validation_error":
      return "Check your details — passwords need at least 8 characters.";
    default:
      if (err.status >= 500) {
        return "Our server hit a problem creating the account. Try again in a moment.";
      }
      return "Couldn't create your account. Check your details and try again.";
  }
}

interface UnifiedAuthPageProps {
  initialMode: AuthMode;
}

export function UnifiedAuthPage({ initialMode }: UnifiedAuthPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const [params] = useSearchParams();

  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Signup state
  const inviteToken = params.get("invite")?.trim() ?? "";
  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [inviteInfo, setInviteInfo] = useState<InviteInfoResponse | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [signupMessage, setSignupMessage] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupSubmitting, setSignupSubmitting] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    document.title =
      mode === "signin" ? "Sign in · Sitropix" : "Create your account · Sitropix";
  }, [mode]);

  useEffect(() => {
    if (mode === "signin" && location.pathname === "/signup") {
      navigate("/login", { replace: true });
    } else if (mode === "signup" && location.pathname === "/login") {
      navigate("/signup", { replace: true });
    }
  }, [mode, location.pathname, navigate]);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    void fetchInviteInfo(inviteToken)
      .then((info) => {
        if (!cancelled) {
          setInviteInfo(info);
          setSignupEmail(info.email);
          setMode("signup");
        }
      })
      .catch(() => {
        if (!cancelled)
          setInviteError("This invitation link is invalid or has expired.");
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  async function handleSignupSubmit(e: FormEvent) {
    e.preventDefault();
    if (!auth) return;
    const { signup } = auth;
    setSignupError(null);
    setSignupSubmitting(true);
    try {
      await signup(name, signupEmail, signupPassword, inviteToken || undefined);
      setSignupMessage(
        inviteToken
          ? "Account created. Check your email to verify, then sign in."
          : "Account created. Verify your email, then sign in.",
      );
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setSignupError(getSignupErrorMessage(err));
    } finally {
      setSignupSubmitting(false);
    }
  }

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    if (!auth) return;
    const { login } = auth;
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const loggedInUser = await login(loginEmail, loginPassword);
      navigate(adminHomePath(loggedInUser.role));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 401) setLoginError("That email and password didn't match. Try again.");
        else if (err.status === 503 || err.message === "database_unavailable")
          setLoginError(
            "Sign-in is offline right now — our database is unreachable. We're on it. Try again in a few minutes.",
          );
        else if (err.status >= 500)
          setLoginError("Something went wrong on our end. Try again shortly.");
        else setLoginError(err.message || "Sign-in failed.");
      } else {
        setLoginError("Couldn't reach the server. Check your connection and try again.");
      }
    } finally {
      setLoginSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="text-left">
        <div className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          {mode === "signin" ? "Welcome back" : "Get started"}
        </div>
        <h1 className="mt-2 font-display text-sx-3xl font-medium leading-tight text-[var(--text-primary)] [letter-spacing:var(--tracking-tight)]">
          {mode === "signin" ? (
            <>
              Sign in to <span className="italic text-[var(--text-brand)]">Sitropix</span>
            </>
          ) : (
            "Create your Sitropix account"
          )}
        </h1>
        <p className="mt-3 text-sx-sm leading-relaxed text-[var(--text-secondary)]">
          {mode === "signin"
            ? "Manage your projects, tickets, and billing — all in one place."
            : "Set up your account in under a minute. Pick a plan when you're ready."}
        </p>
      </header>

      <SxSegmentedControl
        ariaLabel="Switch between sign in and sign up"
        fullWidth
        options={[
          { value: "signin", label: "Sign in" },
          { value: "signup", label: "Create account" },
        ]}
        value={mode}
        onChange={(v) => setMode(v)}
      />

      {mode === "signin" ? (
        <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
          <SxInput
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@business.com"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            required
          />
          <SxInput
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
          />
          <div className="-mt-1 flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sx-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded-sx-xs border-[var(--border-default)] accent-[var(--color-brand-500)]"
              />
              Remember me for 30 days
            </label>
            <Link
              to="/forgot-password"
              className="text-sx-xs font-semibold text-[var(--text-brand)] hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {loginError ? (
            <div
              role="alert"
              className="rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-3 py-2 text-sx-sm text-[var(--color-danger-fg)]"
            >
              {loginError}
            </div>
          ) : null}

          <SxButton type="submit" size="lg" loading={loginSubmitting} fullWidth>
            {loginSubmitting ? "Signing in…" : "Sign in"}
          </SxButton>
        </form>
      ) : (
        <>
          {inviteError ? (
            <div
              role="alert"
              className="rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-3 py-2 text-sx-sm text-[var(--color-danger-fg)]"
            >
              {inviteError}
            </div>
          ) : null}

          {inviteInfo && !inviteError ? (
            <div className="rounded-sx-md border border-[var(--color-info-500)]/30 bg-[var(--color-info-bg)] px-4 py-3 text-sx-sm text-[var(--color-info-fg)]">
              <div className="flex items-center gap-2">
                <SxBadge variant="info">Invite</SxBadge>
                {inviteInfo.planName ? (
                  <span>
                    Plan included: <strong>{inviteInfo.planName}</strong>
                  </span>
                ) : null}
              </div>
              {inviteInfo.message ? (
                <p className="mt-2 whitespace-pre-wrap text-sx-xs leading-relaxed">
                  {inviteInfo.message}
                </p>
              ) : null}
            </div>
          ) : null}

          {!inviteError ? (
            <form onSubmit={handleSignupSubmit} className="flex flex-col gap-4">
              <SxInput
                label="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={120}
                required
                autoComplete="name"
              />
              <SxInput
                label="Email"
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                required
                autoComplete="email"
                readOnly={Boolean(inviteToken && inviteInfo)}
              />
              <SxInput
                label="Password"
                type="password"
                helpText="At least 8 characters."
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                minLength={8}
                maxLength={200}
                required
                autoComplete="new-password"
              />

              {signupError ? (
                <div
                  role="alert"
                  className="rounded-sx-md border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-bg)] px-3 py-2 text-sx-sm text-[var(--color-danger-fg)]"
                >
                  {signupError}
                </div>
              ) : null}

              {signupMessage ? (
                <div className="rounded-sx-md border border-[var(--color-success-500)]/30 bg-[var(--color-success-bg)] px-3 py-2 text-sx-sm text-[var(--color-success-fg)]">
                  {signupMessage}
                </div>
              ) : null}

              <SxButton
                type="submit"
                size="lg"
                loading={signupSubmitting}
                disabled={Boolean(inviteToken && !inviteInfo)}
                fullWidth
              >
                {signupSubmitting ? "Creating account…" : "Create account"}
              </SxButton>

              <p className="text-center text-sx-xs text-[var(--text-tertiary)]">
                By creating an account, you agree to our Terms and Privacy Policy.
              </p>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}
