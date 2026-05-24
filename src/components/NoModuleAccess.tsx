import { Link } from "react-router-dom";

interface NoModuleAccessProps {
  moduleLabel?: string;
}

export function NoModuleAccess({ moduleLabel }: NoModuleAccessProps) {
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
      <h1 className="text-xl font-semibold text-zinc-900">No access to this module</h1>
      <p className="mt-2 text-sm text-amber-900">
        Your account does not currently have permission to open
        {moduleLabel ? ` ${moduleLabel}` : " this admin module"}.
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Ask a master admin to enable this module in Team Access.
      </p>
      <Link
        to="/admin"
        className="mt-4 inline-flex rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50"
      >
        Back to admin dashboard
      </Link>
    </section>
  );
}
