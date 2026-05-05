import { Breadcrumb } from "@/components/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  REQUIRED_PROJECT_ASSETS,
  getProjectById,
  hasValidProjectPlan,
  toggleProjectAddon,
} from "@/services/projectsStore";
import {
  deleteProjectAssetFile,
  downloadProjectAssetFromServer,
  fetchProjectAssets,
  uploadProjectAssetFile,
  type ProjectAssetUploadRow,
} from "@/services/subscriptionsApi";
import type { ProjectRecord, ProjectRequirementType } from "@/types/project";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

function prettyAssetType(value: string) {
  return value.replace(/_/g, " ");
}

function fakeSizeLabel(asset: ProjectAssetUploadRow) {
  if (asset.sizeBytes > 0)
    return `${(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  const base = asset.fileName.length + asset.type.length;
  return `${(Math.max(8, base) / 10).toFixed(1)} MB`;
}

export function ProjectDashboardPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { portal } = useUser();
  const addonCatalog = useMemo(() => portal?.addons ?? [], [portal?.addons]);
  const userId = user?.id ?? portal?.user?.id ?? "guest-user";
  const [, setTick] = useState(0);
  const [serverAssets, setServerAssets] = useState<ProjectAssetUploadRow[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetType, setAssetType] =
    useState<ProjectRequirementType>("requirements");
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [quickUploadType, setQuickUploadType] =
    useState<ProjectRequirementType>("requirements");
  const quickUploadRef = useRef<HTMLInputElement | null>(null);
  const [rawProject, setRawProject] = useState<ProjectRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const ownedProject =
    rawProject && rawProject.ownerUserId === userId ? rawProject : null;
  async function refreshProject() {
    setProjectLoading(true);
    try {
      const row = await getProjectById(projectId);
      setRawProject(row);
    } finally {
      setProjectLoading(false);
    }
  }
  useEffect(() => {
    void refreshProject();
  }, [projectId]);
  async function refreshAssets() {
    if (!ownedProject) {
      setAssetsLoading(false);
      return;
    }
    setAssetsLoading(true);
    try {
      const rows = await fetchProjectAssets(ownedProject.id);
      setServerAssets(rows);
    } catch {
      setServerAssets([]);
      setNotice("Could not load project assets from server.");
    } finally {
      setAssetsLoading(false);
    }
  }
  useEffect(() => {
    void refreshAssets();
  }, [ownedProject?.id]);
  const completedCount = REQUIRED_PROJECT_ASSETS.filter((req) =>
    serverAssets.some((asset) => asset.type === req.type),
  ).length;
  const needsOnboarding = completedCount < REQUIRED_PROJECT_ASSETS.length;
  const hasValidPlan = ownedProject ? hasValidProjectPlan(ownedProject) : false;
  const showSetupOverlay = needsOnboarding || !hasValidPlan;
  const allRequirementsDone = !needsOnboarding;

  if (!ownedProject && !projectLoading)
    return <Navigate to="/projects" replace />;
  if (!ownedProject) {
    return <div className="p-6 text-sm text-zinc-600">Loading project...</div>;
  }
  const project = ownedProject;
  const statusLabel =
    project.subscriptionStatus === "active"
      ? "Active"
      : project.subscriptionStatus === "on_hold"
        ? "On hold"
        : "Not started";

  return (
    <div className="client-workspace-view relative space-y-6 text-zinc-900">
      <Breadcrumb
        items={[
          { label: "Home", to: "/dashboard" },
          { label: "My Projects", to: "/projects" },
          { label: project.name },
        ]}
      />

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              {project.name}
            </h1>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                project.subscriptionStatus === "active"
                  ? "bg-emerald-500/15 text-emerald-700"
                  : project.subscriptionStatus === "on_hold"
                    ? "bg-amber-500/15 text-amber-700"
                    : "bg-zinc-400/15 text-zinc-600"
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Project ID: {project.id.toUpperCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setNotice("Project settings panel will be available soon.")
            }
            className="rounded-xl border border-zinc-500 bg-[#2A3037] px-4 py-2 text-sm font-semibold text-white transition hover:border-zinc-300"
          >
            Project Settings
          </button>
          <Link
            to="/requests"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-zinc-200"
          >
            Contact Support
          </Link>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <article className="rounded-2xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Current plan
            </p>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-3xl font-bold text-white">
                {project.planName ?? "No plan"}
              </h2>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                {project.subscriptionStatus === "active" ? "Active" : "Pending"}
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              Next billing date{" "}
              <span className="client-ink-on-panel font-semibold">
                {fmtDate(project.planValidUntil)}
              </span>
            </p>
            <button
              type="button"
              onClick={() => navigate(`/projects/${project.id}/subscription`)}
              className="mt-5 w-full rounded-xl border border-zinc-500 bg-[#2A3037] px-3 py-2 text-sm font-semibold text-white transition hover:border-zinc-300"
            >
              Manage
            </button>
          </article>

          <article className="rounded-2xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Upgrade
            </p>
            <h2 className="mt-2 text-3xl font-bold leading-tight text-white">
              Upgrade to Pro
            </h2>
            <p className="mt-3 text-sm text-zinc-400">
              Move up from Growth for more capacity and support.
            </p>
            <Link
              to={`/projects/${project.id}/subscription`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-canvas transition hover:bg-zinc-200"
            >
              View Pro
            </Link>
          </article>
        </div>

        <article className="rounded-2xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">Uploaded Assets</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Files required for this project.
              </p>
            </div>
            <label className="cursor-pointer rounded-xl bg-white px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-zinc-200">
              Upload File
              <input
                type="file"
                className="hidden"
                onChange={(e) => setAssetFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {!assetsLoading && serverAssets.length === 0 ? (
            <p className="mt-4 rounded-xl border border-[#2A3037] bg-[#1C2126] px-4 py-3 text-sm text-zinc-400">
              No files uploaded yet.
            </p>
          ) : assetsLoading ? (
            <p className="mt-4 rounded-xl border border-[#2A3037] bg-[#1C2126] px-4 py-3 text-sm text-zinc-400">
              Loading assets...
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {serverAssets.map((asset) => (
                <div
                  key={`${asset.type}:${asset.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#2A3037] bg-[#101317] px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {asset.fileName}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {fakeSizeLabel(asset)} · {prettyAssetType(asset.type)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await downloadProjectAssetFromServer(
                            project.id,
                            asset.type,
                          );
                        } catch {
                          setNotice("Could not download asset.");
                        }
                      }}
                      className="rounded-lg border border-zinc-500 bg-[#2A3037] px-2 py-1 text-[11px] font-medium text-white"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await deleteProjectAssetFile(project.id, asset.type);
                          await refreshAssets();
                        } catch (err) {
                          setNotice(
                            err instanceof Error
                              ? err.message
                              : "Could not remove asset.",
                          );
                        }
                        setTick((v) => v + 1);
                      }}
                      className="rounded-lg border border-zinc-500 bg-[#2A3037] px-2 py-1 text-[11px] font-medium text-white"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form
            className="mt-4 grid gap-2 border-t border-[#2A3037] pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!assetFile) return;
              try {
                await uploadProjectAssetFile(project.id, assetType, assetFile);
                await refreshAssets();
              } catch (err) {
                setNotice(
                  err instanceof Error
                    ? err.message
                    : "Could not upload asset.",
                );
                return;
              }
              setAssetFile(null);
              setTick((v) => v + 1);
            }}
          >
            <select
              value={assetType}
              onChange={(e) =>
                setAssetType(e.target.value as ProjectRequirementType)
              }
              className="rounded-xl border border-[#2A3037] bg-[#1C2126] px-3 py-2 text-sm text-white"
            >
              {REQUIRED_PROJECT_ASSETS.map((req) => (
                <option key={req.type} value={req.type}>
                  {req.label}
                </option>
              ))}
            </select>
            <div className="rounded-xl border border-[#2A3037] bg-[#1C2126] px-3 py-2 text-xs text-zinc-400">
              {assetFile ? assetFile.name : "No file selected"}
            </div>
            <button
              type="submit"
              disabled={!assetFile}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save
            </button>
          </form>
          {notice ? (
            <p className="mt-2 text-xs text-amber-300">{notice}</p>
          ) : null}

          {needsOnboarding ? (
            <p className="mt-3 text-xs text-amber-300">
              Setup progress {completedCount}/{REQUIRED_PROJECT_ASSETS.length} -
              upload all required assets to fully onboard.
            </p>
          ) : null}
        </article>
      </section>

      {showSetupOverlay ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-[2px]">
          <div
            className="w-full max-w-md rounded-3xl border border-[#2A3037] bg-[#161B22] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="inline-flex rounded-full bg-indigo-500/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
              Draft project
            </p>
            <h3 className="mt-3 text-2xl font-bold text-white">
              {project.name}
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              {allRequirementsDone
                ? "All required uploads are complete. Continue to subscription to activate this project."
                : "Upload all required materials so our team can get started."}
            </p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="font-semibold text-white">Setup Progress</span>
              <span className="text-zinc-300">
                {completedCount}/{REQUIRED_PROJECT_ASSETS.length}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#2A3037]">
              <div
                className="h-full bg-white"
                style={{
                  width: `${(completedCount / REQUIRED_PROJECT_ASSETS.length) * 100}%`,
                }}
              />
            </div>
            <ul className="mt-4 space-y-2">
              {REQUIRED_PROJECT_ASSETS.map((req) => {
                const done = serverAssets.some(
                  (asset) => asset.type === req.type,
                );
                return (
                  <li
                    key={req.type}
                    className="flex items-center justify-between rounded-xl border border-[#2A3037] bg-[#0F1318] px-3 py-2"
                  >
                    <span className="text-sm text-white">{req.label}</span>
                    <div className="flex items-center gap-2">
                      {done ? (
                        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                          Completed
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setQuickUploadType(req.type);
                          quickUploadRef.current?.click();
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${done ? "bg-zinc-700 text-zinc-100" : "bg-white text-canvas"}`}
                      >
                        {done ? "Replace" : "Upload"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <input
              ref={quickUploadRef}
              type="file"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await uploadProjectAssetFile(
                    project.id,
                    quickUploadType,
                    file,
                  );
                  await refreshAssets();
                } catch (err) {
                  setNotice(
                    err instanceof Error
                      ? err.message
                      : "Could not upload asset.",
                  );
                  e.currentTarget.value = "";
                  return;
                }
                setTick((v) => v + 1);
                e.currentTarget.value = "";
              }}
            />
            <Link
              to={`/projects/${project.id}/subscription`}
              className={`mt-5 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold ${
                needsOnboarding
                  ? "cursor-not-allowed bg-zinc-700 text-zinc-400"
                  : "bg-white text-canvas"
              }`}
              onClick={(e) => {
                if (needsOnboarding) e.preventDefault();
              }}
            >
              Continue to Subscription
            </Link>
            <p className="mt-3 text-center text-[11px] text-zinc-500">
              A valid subscription is required to activate the project.
            </p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass">
          <h2 className="text-sm font-semibold text-white">
            Uploaded setup files
          </h2>
          {!assetsLoading && serverAssets.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">No files uploaded yet.</p>
          ) : assetsLoading ? (
            <p className="mt-2 text-sm text-zinc-400">Loading assets...</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {serverAssets.map((asset) => (
                <li
                  key={`${asset.type}:${asset.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#2A3037] bg-[#1C2126] px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {asset.fileName}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {asset.type.replace("_", " ")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await downloadProjectAssetFromServer(
                            project.id,
                            asset.type,
                          );
                        } catch {
                          setNotice("Could not download asset.");
                        }
                      }}
                      className="rounded-md border border-zinc-500 bg-[#2A3037] px-2 py-1 text-[10px] font-semibold text-white"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await deleteProjectAssetFile(project.id, asset.type);
                          await refreshAssets();
                        } catch (err) {
                          setNotice(
                            err instanceof Error
                              ? err.message
                              : "Could not remove asset.",
                          );
                        }
                        setTick((v) => v + 1);
                      }}
                      className="rounded-md border border-zinc-500 bg-[#2A3037] px-2 py-1 text-[10px] font-semibold text-white"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-2xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Invoices</h2>
            <Link
              to={`/projects/${project.id}/subscription`}
              className="text-xs font-semibold text-zinc-300 underline"
            >
              Upgrade plan
            </Link>
          </div>
          {project.invoices.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">
              No invoices yet for this project.
            </p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-[#2A3037]">
              <div className="grid grid-cols-12 bg-[#1C2126] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                <div className="col-span-4">Invoice</div>
                <div className="col-span-3">Amount</div>
                <div className="col-span-3">Date</div>
                <div className="col-span-2">Status</div>
              </div>
              {project.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="grid grid-cols-12 border-t border-[#2A3037] px-3 py-2 text-xs text-zinc-200"
                >
                  <div className="col-span-4 font-medium">
                    {inv.invoiceNumber}
                  </div>
                  <div className="col-span-3">
                    {money(inv.amountCents, inv.currency)}
                  </div>
                  <div className="col-span-3">{fmtDate(inv.paidAt)}</div>
                  <div className="col-span-2 capitalize">{inv.status}</div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass">
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Available Add-ons
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Extend your service capabilities.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {addonCatalog.map((addon) => {
            const enabled = project.addons.includes(addon.code);
            return (
              <button
                key={addon.code}
                type="button"
                onClick={async () => {
                  await toggleProjectAddon(project.id, addon.code);
                  await refreshProject();
                  setTick((v) => v + 1);
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  enabled
                    ? "border-white bg-white text-canvas"
                    : "border-[#2A3037] bg-[#1C2126] text-white hover:border-zinc-400"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg font-semibold">{addon.label}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${enabled ? "bg-zinc-900/10 text-canvas" : "bg-zinc-700 text-zinc-100"}`}
                  >
                    {money(addon.priceCents, addon.currency || "USD")}
                  </span>
                </div>
                <p
                  className={`mt-2 text-xs ${enabled ? "text-zinc-700" : "text-zinc-400"}`}
                >
                  {addon.desc}
                </p>
                <span
                  className={`mt-4 inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${
                    enabled ? "bg-canvas text-white" : "bg-white text-canvas"
                  }`}
                >
                  {enabled ? "Added to Plan" : "Add to Plan"}
                </span>
              </button>
            );
          })}
          {addonCatalog.length === 0 ? (
            <p className="sm:col-span-3 rounded-xl border border-[#2A3037] bg-[#1C2126] px-4 py-3 text-sm text-zinc-400">
              No add-ons are available right now.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
