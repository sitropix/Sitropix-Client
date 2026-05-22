import { adminHomePath } from "@/lib/adminAccess";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { fetchInviteInfo, type InviteInfoResponse } from "@/services/authApi";
import { ApiRequestError } from "@/services/http";
import { FormEvent, useEffect, useState } from "react";
import "./UnifiedAuthPage.css";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

type AuthMode = "signin" | "signup";

function getSignupErrorMessage(err: unknown) {
  if (!(err instanceof ApiRequestError)) {
    return "Something went wrong while creating your account. Please try again.";
  }
  switch (err.code) {
    case "email_taken":
      return "This email is already registered. Please sign in or use a different email.";
    case "invite_email_mismatch":
      return "This invite is tied to a different email address. Please use the invited email.";
    case "invite_invalid":
      return "This invitation link is invalid or expired. Ask your admin to send a new invite.";
    case "validation_error":
      return "Please check your details. Password must be at least 8 characters.";
    default:
      if (err.status >= 500) {
        return "Server error while creating account. Please try again in a moment.";
      }
      return "Unable to create account. Please verify your details and try again.";
  }
}

interface UnifiedAuthPageProps {
  initialMode: AuthMode;
}

export function UnifiedAuthPage({ initialMode }: UnifiedAuthPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { isDark, toggleTheme } = useTheme();
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

  // Keep route path / query in sync with selected mode so URLs stay meaningful.
  useEffect(() => {
    if (mode === "signin" && location.pathname === "/signup") {
      navigate("/login", { replace: true });
    } else if (mode === "signup" && location.pathname === "/login") {
      navigate("/signup", { replace: true });
    }
  }, [mode, location.pathname, navigate]);

  // Preserve existing invite behaviour for signup.
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
          ? "Account created from your invite. Check your email to verify, then sign in."
          : "Account created. Please verify your email before first login.",
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
        if (err.status === 401) setLoginError("Invalid email or password.");
        else if (err.status === 503 || err.message === "database_unavailable")
          setLoginError(
            "Sign-in is temporarily unavailable. Try again in a moment.",
          );
        else if (err.status >= 500)
          setLoginError(
            "Something went wrong on the server. Try again shortly.",
          );
        else setLoginError(err.message || "Sign-in failed");
      } else {
        setLoginError(
          "Could not reach the server. Check your connection and try again.",
        );
      }
    } finally {
      setLoginSubmitting(false);
    }
  }

  const authInputClassName =
    "auth-landing-input w-full rounded-2xl px-4 py-4 text-[15px] outline-none transition-all";
  const authActionButtonClassName =
    "auth-landing-cta mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-[16px] font-bold shadow-lg shadow-black/10 transition-colors disabled:cursor-not-allowed disabled:opacity-70 dark:shadow-[0_0_20px_rgba(255,255,255,0.15)]";

  return (
    <div className="auth-landing-shell relative flex min-h-screen overflow-hidden font-body selection:bg-primary/30">
      <button
        type="button"
        onClick={toggleTheme}
        className="auth-landing-theme-toggle absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur transition sm:right-6 sm:top-6"
        aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
        title={`Switch to ${isDark ? "light" : "dark"} theme`}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-gray-500 dark:bg-yellow-300" />
        {isDark ? "Light mode" : "Dark mode"}
      </button>
      <div className="pointer-events-none absolute left-[10%] top-[-20%] h-[60vh] w-[60vw] rounded-full bg-blue-500/10 blur-[120px] mix-blend-multiply dark:bg-blue-600/10 dark:mix-blend-screen" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[10%] h-[50vh] w-[50vw] rounded-full bg-purple-500/10 blur-[120px] mix-blend-multiply dark:bg-purple-600/10 dark:mix-blend-screen" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.4] [background-image:linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] [background-size:4rem_4rem] dark:opacity-[0.03] dark:[background-image:linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)]" />

      <div className="relative z-10 hidden w-1/2 flex-col justify-between p-12 xl:p-16 lg:flex">
        <div className="absolute right-0 top-1/2 h-3/4 w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-black/10 to-transparent dark:via-white/10" />
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-to-tr from-white to-gray-100 flex items-center justify-center border border-gray-200 shadow-sm backdrop-blur-md dark:from-white/10 dark:to-white/5 dark:border-white/10 dark:shadow-[0_0_20px_rgba(255,255,255,0.05)]">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className="auth-landing-text-strong"
            >
              <polygon
                points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="auth-landing-text-strong font-bold text-[20px] leading-none tracking-tight">
            Sitropix
          </p>
        </div>
        <div className="relative max-w-xl xl:max-w-2xl">
          <div className="pointer-events-none absolute -left-8 -top-8 size-32 rounded-full bg-primary/10 blur-[60px] dark:bg-primary/20" />
          <div className="mt-2 mb-8 inline-flex items-center gap-2.5 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm backdrop-blur-md dark:border-white/[0.05] dark:bg-white/[0.02] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)] dark:shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            </span>
            <span className="auth-landing-text-muted text-[12px] font-bold uppercase tracking-widest">
              Unified Client Portal
            </span>
          </div>
          <h1
            className="mb-6 text-[52px] font-headings font-black leading-[1.05] tracking-tighter xl:text-[64px]"
            style={{ color: isDark ? "rgba(255, 255, 255, 0.92)" : "#111827" }}
          >
            One workspace for all your projects.
          </h1>
          <p className="auth-landing-text-muted mb-12 max-w-lg text-[18px] font-medium leading-relaxed xl:text-[20px]">
            Sign in to manage subscriptions, collaborate on assets, and get
            premium support in a single, secure environment.
          </p>
          <div className="relative flex flex-col gap-5">
            <div className="absolute bottom-8 left-6 top-8 w-[2px] bg-gradient-to-b from-blue-500/20 via-purple-500/20 to-transparent blur-[1px] dark:from-blue-500/50 dark:via-purple-500/50" />
            <div className="absolute bottom-8 left-6 top-8 w-px bg-gradient-to-b from-blue-300 via-purple-300 to-transparent opacity-50 dark:from-blue-400 dark:via-purple-400" />
            <div className="relative flex items-start gap-5 rounded-3xl border border-gray-200 bg-white/50 p-5 shadow-sm backdrop-blur-xl dark:border-white/[0.03] dark:bg-white/[0.01] dark:shadow-none">
              <div className="relative z-10 size-12 shrink-0 rounded-2xl bg-gradient-to-b from-blue-100 to-white p-[1px] shadow-[0_4px_12px_rgba(59,130,246,0.1)] dark:from-blue-500/20 dark:to-transparent dark:shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-white dark:bg-[#0a0a0a]">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-blue-500 dark:text-blue-400"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                </div>
              </div>
              <div className="pt-1.5">
                <h3 className="auth-landing-text-strong mb-1.5 text-[16px] font-bold tracking-tight">
                  Manage Multiple Projects
                </h3>
                <p className="auth-landing-text-soft text-[14px] leading-snug">
                  Switch between workspaces seamlessly and track progress.
                </p>
              </div>
            </div>
            <div className="relative flex items-start gap-5 rounded-3xl border border-gray-200 bg-white/50 p-5 shadow-sm backdrop-blur-xl dark:border-white/[0.03] dark:bg-white/[0.01] dark:shadow-none">
              <div className="relative z-10 size-12 shrink-0 rounded-2xl bg-gradient-to-b from-purple-100 to-white p-[1px] shadow-[0_4px_12px_rgba(168,85,247,0.1)] dark:from-purple-500/20 dark:to-transparent dark:shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-white dark:bg-[#0a0a0a]">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-purple-500 dark:text-purple-400"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
              </div>
              <div className="pt-1.5">
                <h3 className="auth-landing-text-strong mb-1.5 text-[16px] font-bold tracking-tight">
                  Unified Billing &amp; Subscriptions
                </h3>
                <p className="auth-landing-text-soft text-[14px] leading-snug">
                  View invoices, upgrade plans, and manage add-ons centrally.
                </p>
              </div>
            </div>
            <div className="relative flex items-start gap-5 rounded-3xl border border-gray-200 bg-white/50 p-5 shadow-sm backdrop-blur-xl dark:border-white/[0.03] dark:bg-white/[0.01] dark:shadow-none">
              <div className="relative z-10 size-12 shrink-0 rounded-2xl bg-gradient-to-b from-emerald-100 to-white p-[1px] shadow-[0_4px_12px_rgba(16,185,129,0.1)] dark:from-emerald-500/20 dark:to-transparent dark:shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-white dark:bg-[#0a0a0a]">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-emerald-500 dark:text-emerald-400"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" />
                    <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
                    <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
                    <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
                    <line x1="14.83" y1="9.17" x2="18.36" y2="5.64" />
                    <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
                  </svg>
                </div>
              </div>
              <div className="pt-1.5">
                <h3 className="auth-landing-text-strong mb-1.5 text-[16px] font-bold tracking-tight">
                  Priority Support
                </h3>
                <p className="auth-landing-text-soft text-[14px] leading-snug">
                  Raise tickets and get help directly from your portal
                  dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="auth-landing-text-soft mt-2 flex items-center gap-8 text-[13px] font-medium">
          <span className="cursor-default">Privacy Policy</span>
          <span className="cursor-default">Terms of Service</span>
          <div className="auth-landing-theme-toggle ml-auto flex items-center gap-2 rounded-full px-4 py-2 shadow-sm backdrop-blur-sm">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="text-emerald-500 dark:text-emerald-400/80"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <span>Enterprise-grade security</span>
          </div>
        </div>
      </div>

      <section className="relative z-10 flex w-full items-center justify-center p-6 sm:p-12 lg:w-1/2">
        <div className="absolute top-8 left-8 lg:hidden flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-gradient-to-tr from-white to-gray-100 flex items-center justify-center border border-gray-200 backdrop-blur-md shadow-sm dark:from-white/10 dark:to-white/5 dark:border-white/10">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="auth-landing-text-strong"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
            </svg>
          </div>
        </div>
        <div className="auth-landing-glass-card relative w-full max-w-[440px] overflow-hidden rounded-[32px] p-8 backdrop-blur-2xl sm:p-10">
          <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-blue-500/5 blur-[60px] dark:bg-blue-500/10" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-purple-500/5 blur-[60px] dark:bg-purple-500/10" />
          <div className="relative z-10 mb-10">
            <h2 className="auth-landing-text-strong mb-2 text-[32px] font-headings font-bold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create your workspace"}
            </h2>
            <p className="auth-landing-text-muted text-[15px]">
              {mode === "signin"
                ? "Enter your details to access your workspace."
                : "Start a new subscription workspace in a few clicks."}
            </p>
          </div>
          <div className="auth-landing-segment relative z-10 mb-8 flex rounded-2xl p-1 text-[14px]">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`auth-landing-segment-btn flex-1 rounded-xl py-2.5 text-center font-bold transition ${
                mode === "signin"
                  ? "is-active shadow-sm"
                  : "transition-colors"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`auth-landing-segment-btn flex-1 rounded-xl py-2.5 text-center font-bold transition ${
                mode === "signup"
                  ? "is-active shadow-sm"
                  : "transition-colors"
              }`}
            >
              Create account
            </button>
          </div>

          {mode === "signin" ? (
            <>
              <form
                className="relative z-10 space-y-5"
                onSubmit={handleLoginSubmit}
              >
                <div className="space-y-2">
                  <label
                    htmlFor="login-email"
                    className="auth-landing-label block text-[13px] font-bold"
                  >
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@company.com"
                    type="email"
                    autoComplete="email"
                    className={authInputClassName}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="auth-landing-label block text-[13px] font-bold"
                    >
                      Password
                    </label>
                    <Link
                      className="auth-landing-link text-[13px] font-medium transition-colors"
                      to="/forgot-password"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    id="login-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    type="password"
                    autoComplete="current-password"
                    className={authInputClassName}
                  />
                </div>

                <label className="auth-landing-text-muted flex items-center gap-2 text-sm">
                  <input
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 bg-white accent-slate-900 dark:border-white/20 dark:bg-white/10 dark:accent-white"
                  />
                  Remember me for 30 days
                </label>

                {loginError && (
                  <p className="text-sm text-rose-500 dark:text-red-400">
                    {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loginSubmitting}
                  className={authActionButtonClassName}
                >
                  {loginSubmitting ? "Signing in…" : "Sign into Workspace"}
                </button>
              </form>
            </>
          ) : (
            <>
              {inviteError && (
                <p className="mt-4 text-sm text-rose-500 dark:text-red-400">
                  {inviteError}
                </p>
              )}
              {inviteInfo?.message && !inviteError && (
                <div className="auth-landing-block auth-landing-text-muted mt-4 rounded-2xl p-3 text-sm">
                  <p className="auth-landing-link text-xs font-semibold uppercase tracking-wide">
                    Message from your team
                  </p>
                  <p className="auth-landing-label mt-2 whitespace-pre-wrap">
                    {inviteInfo.message}
                  </p>
                </div>
              )}
              {inviteInfo?.planName && !inviteError && (
                <p className="auth-landing-text-muted mt-3 text-xs">
                  Plan included:{" "}
                  <span className="auth-landing-text-strong">
                    {inviteInfo.planName}
                  </span>
                </p>
              )}

              {!inviteError && (
                <form
                  className="relative z-10 mt-5 space-y-4"
                  onSubmit={handleSignupSubmit}
                >
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    minLength={2}
                    maxLength={120}
                    required
                    className={authInputClassName}
                  />
                  <input
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    required
                    readOnly={Boolean(inviteToken && inviteInfo)}
                    className={authInputClassName}
                  />
                  <input
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Password (min 8 characters)"
                    type="password"
                    minLength={8}
                    maxLength={200}
                    required
                    className={authInputClassName}
                  />
                  {signupError && (
                    <p className="text-sm text-rose-500 dark:text-red-400">
                      {signupError}
                    </p>
                  )}
                  {signupMessage && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                      {signupMessage}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={
                      signupSubmitting || Boolean(inviteToken && !inviteInfo)
                    }
                    className={`relative ${authActionButtonClassName}`}
                  >
                    {signupSubmitting
                      ? "Creating account…"
                      : "Create workspace account"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
