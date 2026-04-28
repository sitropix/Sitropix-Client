import { Link } from "react-router-dom";

interface NoModuleAccessProps {
  moduleLabel?: string;
}

export function NoModuleAccess({ moduleLabel }: NoModuleAccessProps) {
  return (
    <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6">
      <h1 className="text-xl font-semibold text-white">No access to this module</h1>
      <p className="mt-2 text-sm text-amber-100/90">
        Your account does not currently have permission to open{moduleLabel ? ` ${moduleLabel}` : " this admin module"}.
      </p>
      <p className="mt-1 text-xs text-amber-100/80">Ask a master admin to enable this module in Team Access.</p>
      <Link to="/admin" className="mt-4 inline-flex rounded-full border border-white/20 px-4 py-2 text-sm text-white transition hover:border-brand-lime/35">
        Back to admin dashboard
      </Link>
    </section>
  );
}
