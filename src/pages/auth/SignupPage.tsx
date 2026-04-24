import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiRequestError } from "@/services/http";
import { fetchInviteInfo, type InviteInfoResponse } from "@/services/authApi";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get("invite")?.trim() ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteInfo, setInviteInfo] = useState<InviteInfoResponse | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    void fetchInviteInfo(inviteToken)
      .then((info) => {
        if (!cancelled) {
          setInviteInfo(info);
          setEmail(info.email);
        }
      })
      .catch(() => {
        if (!cancelled) setInviteError("This invitation link is invalid or has expired.");
      });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(name, email, password, inviteToken || undefined);
      setMessage(
        inviteToken
          ? "Account created from your invite. Check your email to verify, then sign in."
          : "Account created. Please verify your email before first login.",
      );
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.message : "";
      const msg =
        code === "invite_email_mismatch"
          ? "Email must match the invitation."
          : code === "invite_invalid"
            ? "Invalid invitation."
            : "Unable to create account";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <h1 className="text-xl font-semibold text-white">Create account</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {inviteToken ? "Complete registration using your invitation." : "Start your secure subscription workspace."}
      </p>

      {inviteError && <p className="mt-4 text-sm text-rose-200">{inviteError}</p>}
      {inviteInfo?.message && !inviteError && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-ink-muted">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-lime">Message from your team</p>
          <p className="mt-2 whitespace-pre-wrap text-white/90">{inviteInfo.message}</p>
        </div>
      )}
      {inviteInfo?.planName && !inviteError && (
        <p className="mt-3 text-xs text-ink-muted">
          Plan included: <span className="text-white">{inviteInfo.planName}</span>
        </p>
      )}

      {!inviteError && (
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            readOnly={Boolean(inviteToken && inviteInfo)}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-lime/35 read-only:opacity-70"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-lime/35"
          />
          {error && <p className="text-sm text-rose-200">{error}</p>}
          {message && <p className="text-sm text-emerald-200">{message}</p>}
          <button
            type="submit"
            disabled={submitting || Boolean(inviteToken && !inviteInfo)}
            className="w-full rounded-full bg-brand-lime px-5 py-2.5 text-sm font-semibold text-canvas transition hover:bg-brand-lime-dim disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create account"}
          </button>
        </form>
      )}
      <p className="mt-4 text-sm text-ink-muted">
        Already have one?{" "}
        <Link className="font-semibold text-brand-lime" to="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
