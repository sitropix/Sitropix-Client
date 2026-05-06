import { FormEvent, useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { ApiRequestError } from "@/services/http";
import { fetchInviteInfo, type InviteInfoResponse } from "@/services/authApi";

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
      await login(loginEmail, loginPassword);
      navigate("/dashboard");
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

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#fafafa] font-body text-foreground selection:bg-primary/30 dark:bg-[#050505]">
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm backdrop-blur transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/15 sm:right-6 sm:top-6"
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
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl border border-gray-200 bg-gradient-to-tr from-white to-gray-100 shadow-sm backdrop-blur-md dark:border-white/10 dark:from-white/10 dark:to-white/5 dark:shadow-[0_0_20px_rgba(255,255,255,0.05)]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                className="text-black dark:text-white"
              >
                <path
                  d="M12 3v4M12 17v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M3 12h4M17 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div className="leading-none">
              <p className="text-[20px] font-bold tracking-tight text-black dark:text-white">
                Sitropix
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-white/55">
                Support
              </p>
            </div>
          </div>
        </div>
        <div className="relative max-w-xl xl:max-w-2xl">
          <div className="pointer-events-none absolute -left-8 -top-8 size-32 rounded-full bg-primary/10 blur-[60px] dark:bg-primary/20" />
          <div className="mt-2 mb-8 inline-flex items-center gap-2.5 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm backdrop-blur-md dark:border-white/[0.05] dark:bg-white/[0.02] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)] dark:shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            </span>
            <span className="text-[12px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-300">
              Unified Client Portal
            </span>
          </div>
          <h1 className="mb-6 bg-gradient-to-b from-black via-gray-800 to-gray-500 bg-clip-text text-[52px] font-headings font-black leading-[1.05] tracking-tighter text-transparent drop-shadow-sm xl:text-[64px] dark:from-white dark:via-white/80 dark:to-white/30 dark:drop-shadow-lg">
            One workspace for all your projects.
          </h1>
          <p className="mb-12 max-w-lg text-[18px] font-medium leading-relaxed text-gray-600 xl:text-[20px] dark:text-white/50">
            Sign in to manage subscriptions, collaborate on assets, and get
            premium support in a single, secure environment.
          </p>
          <div className="relative flex flex-col gap-5">
            <div className="absolute bottom-8 left-6 top-8 w-[2px] bg-gradient-to-b from-blue-500/20 via-purple-500/20 to-transparent blur-[1px] dark:from-blue-500/50 dark:via-purple-500/50" />
            <div className="absolute bottom-8 left-6 top-8 w-px bg-gradient-to-b from-blue-300 via-purple-300 to-transparent opacity-50 dark:from-blue-400 dark:via-purple-400" />
            <div className="relative flex items-start gap-5 rounded-3xl border border-gray-200 bg-white/50 p-5 shadow-sm backdrop-blur-xl dark:border-white/[0.03] dark:bg-white/[0.01] dark:shadow-none">
              <div className="relative z-10 size-12 shrink-0 rounded-2xl bg-gradient-to-b from-blue-100 to-white p-[1px] shadow-[0_4px_12px_rgba(59,130,246,0.1)] dark:from-blue-500/20 dark:to-transparent dark:shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-white dark:bg-[#0a0a0a]" />
              </div>
              <div className="pt-1.5">
                <h3 className="mb-1.5 text-[16px] font-bold tracking-tight text-black dark:text-white">
                  Manage Multiple Projects
                </h3>
                <p className="text-[14px] leading-snug text-gray-500 dark:text-white/40">
                  Switch between workspaces seamlessly and track progress.
                </p>
              </div>
            </div>
            <div className="relative flex items-start gap-5 rounded-3xl border border-gray-200 bg-white/50 p-5 shadow-sm backdrop-blur-xl dark:border-white/[0.03] dark:bg-white/[0.01] dark:shadow-none">
              <div className="relative z-10 size-12 shrink-0 rounded-2xl bg-gradient-to-b from-purple-100 to-white p-[1px] shadow-[0_4px_12px_rgba(168,85,247,0.1)] dark:from-purple-500/20 dark:to-transparent dark:shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-white dark:bg-[#0a0a0a]" />
              </div>
              <div className="pt-1.5">
                <h3 className="mb-1.5 text-[16px] font-bold tracking-tight text-black dark:text-white">
                  Unified Billing &amp; Subscriptions
                </h3>
                <p className="text-[14px] leading-snug text-gray-500 dark:text-white/40">
                  View invoices, upgrade plans, and manage add-ons centrally.
                </p>
              </div>
            </div>
            <div className="relative flex items-start gap-5 rounded-3xl border border-gray-200 bg-white/50 p-5 shadow-sm backdrop-blur-xl dark:border-white/[0.03] dark:bg-white/[0.01] dark:shadow-none">
              <div className="relative z-10 size-12 shrink-0 rounded-2xl bg-gradient-to-b from-emerald-100 to-white p-[1px] shadow-[0_4px_12px_rgba(16,185,129,0.1)] dark:from-emerald-500/20 dark:to-transparent dark:shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-white dark:bg-[#0a0a0a]" />
              </div>
              <div className="pt-1.5">
                <h3 className="mb-1.5 text-[16px] font-bold tracking-tight text-black dark:text-white">
                  Priority Support
                </h3>
                <p className="text-[14px] leading-snug text-gray-500 dark:text-white/40">
                  Raise tickets and get help directly from your portal
                  dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-8 text-[13px] font-medium text-gray-400 dark:text-white/40">
          <span className="cursor-default">Privacy Policy</span>
          <span className="cursor-default">Terms of Service</span>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-gray-600 shadow-sm backdrop-blur-sm dark:border-white/5 dark:bg-white/5 dark:text-white/60">
            <span>Enterprise-grade security</span>
          </div>
        </div>
      </div>

      <section className="relative z-10 flex w-full items-center justify-center p-6 sm:p-12 lg:w-1/2">
        <div className="relative w-full max-w-[440px] overflow-hidden rounded-[32px] border border-gray-200 bg-white/90 p-8 shadow-2xl backdrop-blur-2xl dark:border-white/[0.05] dark:bg-[#0a0a0a]/80 dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] sm:p-10">
          <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-blue-500/5 blur-[60px] dark:bg-blue-500/10" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-purple-500/5 blur-[60px] dark:bg-purple-500/10" />
          <div className="relative z-10 mb-10">
            <h2 className="mb-2 text-[32px] font-headings font-bold tracking-tight text-black dark:text-white">
              {mode === "signin" ? "Welcome back" : "Create your workspace"}
            </h2>
            <p className="text-[15px] text-gray-500 dark:text-white/50">
              {mode === "signin"
                ? "Enter your details to access your workspace."
                : "Start a new subscription workspace in a few clicks."}
            </p>
          </div>
          <div className="relative z-10 mb-8 flex rounded-2xl border border-gray-200 bg-gray-50/50 p-1 text-[14px] dark:border-white/[0.05] dark:bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-xl py-2.5 text-center font-bold transition ${
                mode === "signin"
                  ? "border border-gray-200 bg-white text-black shadow-sm dark:border-white/[0.05] dark:bg-white/[0.08] dark:text-white"
                  : "text-gray-400 transition-colors hover:text-gray-600 dark:text-white/40 dark:hover:text-white/60"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-xl py-2.5 text-center font-bold transition ${
                mode === "signup"
                  ? "border border-gray-200 bg-white text-black shadow-sm dark:border-white/[0.05] dark:bg-white/[0.08] dark:text-white"
                  : "text-gray-400 transition-colors hover:text-gray-600 dark:text-white/40 dark:hover:text-white/60"
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
                    className="block text-[13px] font-bold text-gray-700 dark:text-white/80"
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
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-[15px] text-black outline-none transition-all placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/80 dark:placeholder:text-white/35 dark:focus:border-white/20 dark:focus:ring-0"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="block text-[13px] font-bold text-gray-700 dark:text-white/80"
                    >
                      Password
                    </label>
                    <Link
                      className="text-[13px] font-medium text-blue-500 transition-colors hover:text-blue-600 dark:text-blue-400"
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
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-[15px] text-black outline-none transition-all placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/80 dark:placeholder:text-white/35 dark:focus:border-white/20 dark:focus:ring-0"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
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
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-5 py-4 text-[16px] font-bold text-white shadow-lg shadow-black/10 transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-black dark:hover:bg-white/90 dark:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
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
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/70">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-blue-300">
                    Message from your team
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-gray-700 dark:text-white/80">
                    {inviteInfo.message}
                  </p>
                </div>
              )}
              {inviteInfo?.planName && !inviteError && (
                <p className="mt-3 text-xs text-gray-500 dark:text-white/50">
                  Plan included:{" "}
                  <span className="text-black dark:text-white">
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
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-[15px] text-black outline-none transition-all placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/80 dark:placeholder:text-white/35 dark:focus:border-white/20 dark:focus:ring-0"
                  />
                  <input
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    required
                    readOnly={Boolean(inviteToken && inviteInfo)}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-[15px] text-black outline-none transition-all placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 read-only:bg-gray-50 read-only:text-gray-500 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/80 dark:placeholder:text-white/35 dark:focus:border-white/20 dark:focus:ring-0 dark:read-only:bg-white/[0.04] dark:read-only:text-white/50"
                  />
                  <input
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Password (min 8 characters)"
                    type="password"
                    minLength={8}
                    maxLength={200}
                    required
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-[15px] text-black outline-none transition-all placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-white/80 dark:placeholder:text-white/35 dark:focus:border-white/20 dark:focus:ring-0"
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
                    className="relative mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-black px-5 py-4 text-[16px] font-bold text-white shadow-lg shadow-black/10 transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-black dark:hover:bg-white/90 dark:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
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
