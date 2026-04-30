import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useUser } from "@/context/UserContext";
import { REQUIRED_PROJECT_ASSETS, getProjectById, toggleProjectAddon, uploadProjectAsset } from "@/services/projectsStore";
import type { ProjectRequirementType } from "@/types/project";
import type { ProjectAsset } from "@/types/project";

const ADDONS = [
  { code: "priority-support", label: "Priority Support", description: "Get faster response times and dedicated account management.", price: "$49/mo" },
  { code: "extra-storage", label: "Extra Storage", description: "Add 50GB of secure storage for your project assets.", price: "$19/mo" },
  { code: "analytics-pack", label: "Analytics Dashboard", description: "Advanced tracking and reporting for your campaign.", price: "$29/mo" },
];

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

function prettyAssetType(value: string) {
  return value.replace(/_/g, " ");
}

function fakeSizeLabel(asset: ProjectAsset) {
  const base = asset.fileName.length + asset.type.length;
  return `${(Math.max(8, base) / 10).toFixed(1)} MB`;
}

export function ProjectDashboardPage() {
  const { projectId = "" } = useParams();
  const { portal } = useUser();
  const userId = portal?.user?.id ?? "guest-user";
  const [tick, setTick] = useState(0);
  const [assetType, setAssetType] = useState<ProjectRequirementType>("requirements");
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const project = useMemo(() => getProjectById(projectId), [projectId, tick]);
  if (!project || project.ownerUserId !== userId) return <Navigate to="/projects" replace />;
  const completedCount = REQUIRED_PROJECT_ASSETS.filter((req) =>
    project.assets.some((asset) => asset.type === req.type),
  ).length;
  const needsOnboarding = completedCount < REQUIRED_PROJECT_ASSETS.length;

  const statusLabel = project.subscriptionStatus === "active" ? "Active" : project.subscriptionStatus === "on_hold" ? "On hold" : "Not started";

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Home", to: "/dashboard" },
          { label: "My Projects", to: "/projects" },
          { label: project.name },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-zinc-300 bg-white/90 p-5 shadow-glass sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{project.name}</h1>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
              project.subscriptionStatus === "active"
                ? "bg-emerald-500/15 text-emerald-700"
                : project.subscriptionStatus === "on_hold"
                  ? "bg-amber-500/15 text-amber-700"
                  : "bg-zinc-400/15 text-zinc-600"
            }`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">Project ID: {project.id.toUpperCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-500">
            Project Settings
          </button>
          <Link
            to="/requests"
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Contact Support
          </Link>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <article className="rounded-2xl border border-zinc-300 bg-white/90 p-5 shadow-glass">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Current plan</p>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-3xl font-bold text-zinc-900">{project.planName ?? "Growth"}</h2>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                {project.subscriptionStatus === "active" ? "Active" : "Pending"}
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-600">
              Next billing date{" "}
              <span className="font-semibold text-zinc-900">
                {fmtDate(project.invoices[0]?.paidAt ?? null)}
              </span>
            </p>
            <button className="mt-5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-500">
              Manage
            </button>
          </article>

          <article className="rounded-2xl border border-zinc-300 bg-white/90 p-5 shadow-glass">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Upgrade</p>
            <h2 className="mt-2 text-3xl font-bold leading-tight text-zinc-900">Upgrade to Pro</h2>
            <p className="mt-3 text-sm text-zinc-600">Move up from Growth for more capacity and support.</p>
            <Link
              to={`/projects/${project.id}/subscription`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-500"
            >
              View Pro
            </Link>
          </article>
        </div>

        <article className="rounded-2xl border border-zinc-300 bg-white/90 p-5 shadow-glass">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">Uploaded Assets</h2>
              <p className="mt-1 text-sm text-zinc-600">Files required for this project.</p>
            </div>
            <label className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800">
              Upload File
              <input
                type="file"
                className="hidden"
                onChange={(e) => setAssetFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {project.assets.length === 0 ? (
            <p className="mt-4 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              No files uploaded yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {project.assets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-300 bg-zinc-50/80 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{asset.fileName}</p>
                    <p className="text-xs text-zinc-500">{fakeSizeLabel(asset)} · {prettyAssetType(asset.type)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700">↓</button>
                    <button className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form
            className="mt-4 grid gap-2 border-t border-zinc-200 pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!assetFile) return;
              uploadProjectAsset(project.id, assetType, assetFile.name);
              setAssetFile(null);
              setTick((v) => v + 1);
            }}
          >
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as ProjectRequirementType)}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
            >
              {REQUIRED_PROJECT_ASSETS.map((req) => (
                <option key={req.type} value={req.type}>
                  {req.label}
                </option>
              ))}
            </select>
            <div className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              {assetFile ? assetFile.name : "No file selected"}
            </div>
            <button
              type="submit"
              disabled={!assetFile}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
          </form>

          {needsOnboarding ? (
            <p className="mt-3 text-xs text-amber-700">
              Setup progress {completedCount}/{REQUIRED_PROJECT_ASSETS.length} - upload all required assets to fully onboard.
            </p>
          ) : null}
        </article>
      </section>

      {project.subscriptionStatus !== "active" ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
          This project is currently on hold. Activate subscription to start service delivery.
          <Link to={`/projects/${project.id}/subscription`} className="ml-2 font-semibold underline">
            Complete subscription
          </Link>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-zinc-300 bg-white/90 p-5 shadow-glass">
          <h2 className="text-sm font-semibold text-zinc-900">Uploaded setup files</h2>
          {project.assets.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">No files uploaded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {project.assets.map((asset) => (
                <li key={asset.id} className="rounded-lg border border-zinc-300 bg-zinc-50/80 px-3 py-2">
                  <p className="text-sm font-medium text-zinc-800">{asset.fileName}</p>
                  <p className="text-xs text-zinc-500">{asset.type.replace("_", " ")}</p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-zinc-300 bg-white/90 p-5 shadow-glass">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Invoices</h2>
            <Link to={`/projects/${project.id}/subscription`} className="text-xs font-semibold text-zinc-700 underline">
              Upgrade plan
            </Link>
          </div>
          {project.invoices.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">No invoices yet for this project.</p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-300">
              <div className="grid grid-cols-12 bg-zinc-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                <div className="col-span-4">Invoice</div>
                <div className="col-span-3">Amount</div>
                <div className="col-span-3">Date</div>
                <div className="col-span-2">Status</div>
              </div>
              {project.invoices.map((inv) => (
                <div key={inv.id} className="grid grid-cols-12 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-700">
                  <div className="col-span-4 font-medium">{inv.invoiceNumber}</div>
                  <div className="col-span-3">{money(inv.amountCents, inv.currency)}</div>
                  <div className="col-span-3">{fmtDate(inv.paidAt)}</div>
                  <div className="col-span-2 capitalize">{inv.status}</div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-zinc-300 bg-white/90 p-5 shadow-glass">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Available Add-ons</h2>
        <p className="mt-1 text-sm text-zinc-600">Extend your service capabilities.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {ADDONS.map((addon) => {
            const enabled = project.addons.includes(addon.code);
            return (
              <button
                key={addon.code}
                type="button"
                onClick={() => {
                  toggleProjectAddon(project.id, addon.code);
                  setTick((v) => v + 1);
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  enabled ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg font-semibold">{addon.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${enabled ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                    {addon.price}
                  </span>
                </div>
                <p className={`mt-2 text-xs ${enabled ? "text-zinc-100/80" : "text-zinc-600"}`}>{addon.description}</p>
                <span className={`mt-4 inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${
                  enabled ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"
                }`}>
                  {enabled ? "Added to Plan" : "Add to Plan"}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

