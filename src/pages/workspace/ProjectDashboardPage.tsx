import { Breadcrumb } from "@/components/Breadcrumb";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  CORE_REQUIRED_PROJECT_ASSETS,
  PROJECT_ASSET_TYPES,
  getProjectById,
  hasValidProjectPlan,
} from "@/services/projectsStore";
import {
  confirmAddonCheckoutSession,
  createAddonCheckoutSession,
} from "@/services/subscriptionsApi";
import { ExtraEditPurchaseModal } from "@/components/billing/ExtraEditPurchaseModal";
import {
  canOfferExtraEditPurchases,
  isCreditPackAddon,
  readPlanExtraEditPricing,
  resolveExtraEditPurchaseAddons,
} from "@/constants/extraEditAddons";
import { maxPurchasableExtraEditCredits } from "@/lib/websiteEditCreditsLimit";
import { formatFileSize } from "@/lib/formatFileSize";
import {
  deleteProjectAssetFile,
  downloadProjectAssetFromServer,
  fetchProjectAssets,
  uploadProjectAssetFile,
  type ProjectAssetUploadRow,
} from "@/services/subscriptionsApi";
import type { ProjectRecord, ProjectRequirementType } from "@/types/project";
import type { SubscriptionAddon } from "@/types/subscription";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

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

function resolveExtraEditAddonDisplayCents(
  addon: { code: string; priceCents?: number },
  plans: { id: string; catalogJson?: Record<string, unknown> }[],
  projectPlanId: string | null | undefined,
) {
  if (addon.code !== "addon_extra_edit_single" && addon.code !== "addon_extra_edit_bundle") {
    return addon.priceCents ?? 0;
  }
  const plan = plans.find((p) => p.id === projectPlanId);
  const j = (plan?.catalogJson ?? {}) as Record<string, unknown>;
  if (addon.code === "addon_extra_edit_single") {
    const c = typeof j.extraEditSingleCents === "number" ? j.extraEditSingleCents : 0;
    return Math.max(0, c);
  }
  const c = typeof j.extraEditPackCents === "number" ? j.extraEditPackCents : 0;
  return Math.max(0, c);
}

function extraEditAddonCaption(
  addon: { code: string },
  plans: { id: string; catalogJson?: Record<string, unknown> }[],
  projectPlanId: string | null | undefined,
) {
  if (addon.code === "addon_extra_edit_single") return "1 credit";
  if (addon.code !== "addon_extra_edit_bundle") return "";
  const plan = plans.find((p) => p.id === projectPlanId);
  const j = (plan?.catalogJson ?? {}) as Record<string, unknown>;
  const n = typeof j.extraEditPackCount === "number" ? j.extraEditPackCount : 0;
  return n > 0 ? `${n} credits` : "";
}

function addonCardDisplayCents(
  addon: SubscriptionAddon,
  plans: { id: string; catalogJson?: Record<string, unknown> }[],
  projectPlanId: string | null | undefined,
) {
  if (addon.billingKind === "recurring" && (addon.setupFeeCents ?? 0) > 0) {
    return (addon.setupFeeCents ?? 0) + (addon.priceCents ?? 0);
  }
  return resolveExtraEditAddonDisplayCents(addon, plans, projectPlanId);
}

function recurringSetupPriceBreakdown(addon: SubscriptionAddon, ccy: string) {
  const setup = addon.setupFeeCents ?? 0;
  if (addon.billingKind !== "recurring" || setup <= 0) return null;
  const rec = addon.priceCents ?? 0;
  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-[11px] leading-snug text-zinc-300">
      <div className="flex justify-between gap-2">
        <span className="text-zinc-500">Setup (one-time)</span>
        <span className="tabular-nums font-medium text-white">{money(setup, ccy)}</span>
      </div>
      <div className="mt-1 flex justify-between gap-2">
        <span className="text-zinc-500">Recurring (per month)</span>
        <span className="tabular-nums font-medium text-white">{money(rec, ccy)}</span>
      </div>
      <p className="mt-1.5 border-t border-white/5 pt-1.5 text-[10px] text-zinc-500">
        First checkout charges setup + first billing cycle; renewals bill the recurring amount only.
      </p>
    </div>
  );
}

const ADDONS_PAGE_SIZE = 6;

function IconPuzzle(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className} aria-hidden>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconPencil(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className} aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function IconGrid(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconInfo(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function daysUntilReset(planValidUntil: string | null): number | null {
  if (!planValidUntil) return null;
  const end = new Date(planValidUntil).getTime();
  if (!Number.isFinite(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86400000);
}

export function ProjectDashboardPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { portal } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const addonCatalog = useMemo(() => portal?.addons ?? [], [portal?.addons]);
  const plans = useMemo(() => portal?.plans ?? [], [portal?.plans]);
  const purchasableAddons = useMemo(
    () =>
      addonCatalog.filter(
        (a) =>
          !isCreditPackAddon(a) &&
          (a.billingKind !== "recurring" ||
            (typeof a.setupFeeCents === "number" && a.setupFeeCents > 0)),
      ),
    [addonCatalog],
  );
  const [addonPage, setAddonPage] = useState(0);
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
  const [addonCheckoutBusy, setAddonCheckoutBusy] = useState(false);
  const [extraEditModalOpen, setExtraEditModalOpen] = useState(false);
  const [assetFormUploadBusy, setAssetFormUploadBusy] = useState(false);
  const [quickAssetUploadBusy, setQuickAssetUploadBusy] = useState(false);
  const assetUploadBusy = assetFormUploadBusy || quickAssetUploadBusy;
  const [assetDownloadBusyType, setAssetDownloadBusyType] =
    useState<ProjectRequirementType | null>(null);
  const [assetDeleteBusyType, setAssetDeleteBusyType] =
    useState<ProjectRequirementType | null>(null);
  const addonReturnHandledRef = useRef<string | null>(null);
  const ownedProject =
    rawProject && rawProject.ownerUserId === userId ? rawProject : null;
  async function refreshProject(opts?: { silent?: boolean }) {
    const silent = opts?.silent === true;
    if (!silent) setProjectLoading(true);
    try {
      const row = await getProjectById(projectId);
      setRawProject(row);
    } finally {
      if (!silent) setProjectLoading(false);
    }
  }
  useEffect(() => {
    void refreshProject();
  }, [projectId]);

  const addonFunnel = searchParams.get("subscriptionFunnel");
  const addonSessionId = searchParams.get("session_id");
  const addonProjectParam = searchParams.get("projectId");

  useEffect(() => {
    if (addonFunnel !== "addon_checkout_return") return;
    if (!addonSessionId || !addonProjectParam || addonProjectParam !== projectId) return;
    if (addonReturnHandledRef.current === addonSessionId) return;
    addonReturnHandledRef.current = addonSessionId;
    void (async () => {
      try {
        await confirmAddonCheckoutSession(projectId, addonSessionId);
        // Redirect to the My Projects overview; do not auto-open this project.
        navigate(
          { pathname: "/projects", search: "?payment_success=1&payment_source=addon" },
          { replace: true },
        );
        return;
      } catch (err) {
        setNotice(
          err instanceof Error ? err.message : "Could not confirm add-on purchase.",
        );
      }
      // If we stay here (error), clear the query params to avoid noisy retries.
      setSearchParams({}, { replace: true });
    })();
  }, [
    addonFunnel,
    addonSessionId,
    addonProjectParam,
    projectId,
    setSearchParams,
    navigate,
  ]);
  async function refreshAssets(opts?: { silent?: boolean }) {
    if (!ownedProject) {
      setAssetsLoading(false);
      return;
    }
    const silent = opts?.silent === true;
    if (!silent) setAssetsLoading(true);
    try {
      const rows = await fetchProjectAssets(ownedProject.id, { force: true });
      setServerAssets(rows);
    } catch {
      setServerAssets([]);
      setNotice("Could not load project assets from server.");
    } finally {
      if (!silent) setAssetsLoading(false);
    }
  }
  useEffect(() => {
    void refreshAssets();
  }, [ownedProject?.id]);
  const coreRequired = CORE_REQUIRED_PROJECT_ASSETS;
  const completedCoreCount = coreRequired.filter((req) =>
    serverAssets.some((asset) => asset.type === req.type),
  ).length;
  const assetsReady = !assetsLoading;
  const needsOnboarding = assetsReady && completedCoreCount < coreRequired.length;
  const hasValidPlan = ownedProject ? hasValidProjectPlan(ownedProject) : false;
  const showSetupOverlay = assetsReady && !hasValidPlan;
  const allRequirementsDone = assetsReady && !needsOnboarding;
  const ownedAddonCodes = ownedProject?.addons ?? [];
  const availableAddons = useMemo(
    () => purchasableAddons.filter((addon) => !ownedAddonCodes.includes(addon.code)),
    [purchasableAddons, ownedAddonCodes],
  );
  const addonPageCount = Math.max(1, Math.ceil(availableAddons.length / ADDONS_PAGE_SIZE));
  const addonPageSafe = Math.min(addonPage, addonPageCount - 1);
  const pagedAvailableAddons = availableAddons.slice(
    addonPageSafe * ADDONS_PAGE_SIZE,
    addonPageSafe * ADDONS_PAGE_SIZE + ADDONS_PAGE_SIZE,
  );
  useEffect(() => {
    setAddonPage((p) => Math.min(p, Math.max(0, addonPageCount - 1)));
  }, [addonPageCount]);

  if (!ownedProject && !projectLoading)
    return <Navigate to="/projects" replace />;
  if (!ownedProject) {
    return <div className="p-6 text-sm text-zinc-600">Loading project...</div>;
  }
  const project = ownedProject;
  const resetDays = daysUntilReset(project.planValidUntil);
  const usage = project.usage;
  const editCap = usage?.includedCreditsPerPeriod ?? 0;
  const editUsed = usage?.includedCreditsUsedThisPeriod ?? 0;
  const purchasedBal = usage?.purchasedCreditsBalance ?? 0;
  const includedDepleted = editCap > 0 && editUsed >= editCap;
  const pagesMax = usage?.pagesIncludedMax ?? null;
  const pagesUsed = usage?.pagesUsed ?? 0;
  const pagesProgress =
    pagesMax != null && pagesMax > 0 ? Math.min(100, Math.round((pagesUsed / pagesMax) * 100)) : 0;
  const planForProject = plans.find((p) => p.id === project.planId) ?? null;
  const { single: extraEditSinglePurchAddon, bundle: extraEditBundleAddon } =
    resolveExtraEditPurchaseAddons(addonCatalog, planForProject);
  const { perEditCents: modalPerEditCents, bundleCredits: modalBundleCredits, bundleCents: modalBundleCents } =
    readPlanExtraEditPricing(planForProject);
  const maxExtraEditsBuyable = maxPurchasableExtraEditCredits(usage, planForProject);
  const canBuyExtraEdits =
    hasValidPlan &&
    canOfferExtraEditPurchases(planForProject, addonCatalog) &&
    maxExtraEditsBuyable > 0;

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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-white">{project.name}</h1>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                project.subscriptionStatus === "active"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : project.subscriptionStatus === "on_hold"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-zinc-500/20 text-zinc-400"
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="mt-2 font-mono text-xs text-zinc-500">
            Project ID: {project.id.toUpperCase()}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              document.getElementById("project-add-ons")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-600 bg-[#1C2126] px-4 py-2 text-sm font-semibold text-white transition hover:border-zinc-400 hover:bg-[#232a32]"
          >
            <IconPuzzle className="h-4 w-4 shrink-0 text-zinc-300" />
            Manage Add-ons
          </button>
          <button
            type="button"
            onClick={() => setNotice("Project settings panel will be available soon.")}
            className="rounded-xl border border-zinc-600 bg-[#1C2126] px-4 py-2 text-sm font-semibold text-white transition hover:border-zinc-400 hover:bg-[#232a32]"
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

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="grid gap-4">
          <article className="rounded-2xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Current plan</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">{project.planName ?? "No plan"}</h2>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400">
                {project.subscriptionStatus === "active" ? "Active" : "Pending"}
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              Next billing date{" "}
              <span className="font-semibold text-zinc-200">{fmtDate(project.planValidUntil)}</span>
            </p>
            <button
              type="button"
              onClick={() => navigate(`/projects/${project.id}/subscription`)}
              className="mt-5 w-full rounded-xl border border-zinc-600 bg-[#1C2126] px-3 py-2.5 text-sm font-semibold text-white transition hover:border-zinc-400 hover:bg-[#232a32]"
            >
              Manage
            </button>
          </article>

          <article className="rounded-2xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-bold text-white">Plan usage</h3>
              {resetDays != null ? (
                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Resets in {resetDays} {resetDays === 1 ? "day" : "days"}
                </span>
              ) : null}
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                    <IconPencil className="h-4 w-4 text-emerald-400/90" />
                    Website edits
                  </div>
                  {usage ? (
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        includedDepleted ? "text-rose-400" : "text-zinc-300"
                      }`}
                    >
                      {editUsed} / {editCap} used
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">—</span>
                  )}
                </div>
                {usage && purchasedBal > 0 ? (
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {purchasedBal} purchased credit{purchasedBal === 1 ? "" : "s"} also available this period.
                  </p>
                ) : null}
                {canBuyExtraEdits ? (
                  <div
                    className={`mt-3 rounded-xl border px-3 py-3 ${
                      includedDepleted
                        ? "border-rose-500/25 bg-rose-950/30"
                        : "border-[#2A3037] bg-[#101317]"
                    }`}
                  >
                    {includedDepleted ? (
                      <div className="flex gap-2">
                        <IconInfo className="mt-0.5 h-4 w-4 shrink-0 text-rose-300/90" />
                        <p className="text-xs leading-relaxed text-rose-100/90">
                          You&apos;ve used all included edits for this billing cycle.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs leading-relaxed text-zinc-400">
                        Purchase additional website edit credits at your plan rate.
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={addonCheckoutBusy}
                      onClick={() => setExtraEditModalOpen(true)}
                      className={`mt-3 w-full rounded-lg py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        includedDepleted
                          ? "border border-rose-400/30 bg-[#1a1416] text-rose-100 hover:bg-rose-950/50"
                          : "border border-zinc-600 bg-[#1C2126] text-white hover:border-zinc-400 hover:bg-[#232a32]"
                      }`}
                    >
                      {addonCheckoutBusy ? "Starting checkout…" : "Buy edit credits"}
                    </button>
                  </div>
                ) : null}
                {!usage && hasValidPlan ? (
                  <p className="mt-2 text-xs text-zinc-500">Usage will appear after the next sync.</p>
                ) : null}
              </div>

              {pagesMax != null && pagesMax > 0 ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                      <IconGrid className="h-4 w-4 text-emerald-400/90" />
                      Pages used
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-zinc-300">
                      {pagesUsed} / {pagesMax}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#2A3037]">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width]"
                      style={{ width: `${pagesProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </article>

        </div>

        <article className="rounded-2xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-white">Uploaded assets</h2>
              <p className="mt-1 text-sm text-zinc-400">Files required for this project.</p>
            </div>
            <label
              className={`cursor-pointer rounded-xl bg-white px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-zinc-200 ${
                assetUploadBusy || assetDeleteBusyType ? "pointer-events-none cursor-not-allowed opacity-50" : ""
              }`}
            >
              Upload file
              <input
                type="file"
                disabled={assetUploadBusy || assetDeleteBusyType !== null}
                className="hidden"
                onChange={(e) => {
                  setAssetFile(e.target.files?.[0] ?? null);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          {!assetsLoading && serverAssets.length === 0 ? (
            <p className="mt-4 rounded-xl border border-[#2A3037] bg-[#1C2126] px-4 py-3 text-sm text-zinc-400">
              No files uploaded yet.
            </p>
          ) : assetsLoading ? (
            <p className="mt-4 rounded-xl border border-[#2A3037] bg-[#1C2126] px-4 py-3 text-sm text-zinc-400">
              Loading assets…
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[#2A3037] rounded-xl border border-[#2A3037] bg-[#101317]">
              {serverAssets.map((asset) => (
                <li
                  key={`${asset.type}:${asset.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 first:rounded-t-xl last:rounded-b-xl"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{asset.fileName}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {formatFileSize(asset.sizeBytes)} · {prettyAssetType(asset.type)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      title="Download"
                      disabled={
                        assetUploadBusy || assetDeleteBusyType !== null || assetDownloadBusyType === asset.type
                      }
                      onClick={async () => {
                        setAssetDownloadBusyType(asset.type);
                        setNotice(null);
                        try {
                          await downloadProjectAssetFromServer(project.id, asset.type);
                        } catch {
                          setNotice("Could not download asset.");
                        } finally {
                          setAssetDownloadBusyType(null);
                        }
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-600 bg-[#1C2126] text-zinc-200 transition hover:border-zinc-400 hover:bg-[#252b33] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="sr-only">Download</span>
                      <span className="text-sm leading-none" aria-hidden>
                        {assetDownloadBusyType === asset.type ? "…" : "↓"}
                      </span>
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      disabled={assetUploadBusy || assetDeleteBusyType !== null}
                      onClick={async () => {
                        setAssetDeleteBusyType(asset.type);
                        setNotice(null);
                        try {
                          await deleteProjectAssetFile(project.id, asset.type);
                          await refreshAssets({ silent: true });
                        } catch (err) {
                          setNotice(err instanceof Error ? err.message : "Could not remove asset.");
                        } finally {
                          setAssetDeleteBusyType(null);
                        }
                        setTick((v) => v + 1);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-600 bg-[#1C2126] text-zinc-200 transition hover:border-rose-400/50 hover:bg-rose-950/30 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="sr-only">Delete</span>
                      <span className="text-sm leading-none" aria-hidden>
                        {assetDeleteBusyType === asset.type ? "…" : "✕"}
                      </span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form
            className="mt-4 grid gap-2 border-t border-[#2A3037] pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!assetFile || assetUploadBusy) return;
              setAssetFormUploadBusy(true);
              setNotice(null);
              try {
                await uploadProjectAssetFile(project.id, assetType, assetFile);
                await refreshAssets({ silent: true });
                await refreshProject({ silent: true });
              } catch (err) {
                setNotice(err instanceof Error ? err.message : "Could not upload asset.");
                return;
              } finally {
                setAssetFormUploadBusy(false);
              }
              setAssetFile(null);
              setNotice(null);
              setTick((v) => v + 1);
            }}
          >
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as ProjectRequirementType)}
              disabled={assetUploadBusy}
              className="rounded-xl border border-[#2A3037] bg-[#1C2126] px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {PROJECT_ASSET_TYPES.map((req) => (
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
              disabled={!assetFile || assetUploadBusy}
              aria-busy={assetFormUploadBusy}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {assetFormUploadBusy ? "Saving…" : "Save"}
            </button>
          </form>
          {notice ? <p className="mt-2 text-xs text-amber-300">{notice}</p> : null}

          {needsOnboarding ? (
            <p className="mt-3 text-xs text-amber-300">
              Required setup {completedCoreCount}/{coreRequired.length} — upload requirement docs and branding to
              continue. Other file types are optional.
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
                : "Upload the required items below. Additional materials help us deliver faster but are optional."}
            </p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="font-semibold text-white">Required progress</span>
              <span className="text-zinc-300">
                {completedCoreCount}/{coreRequired.length}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#2A3037]">
              <div
                className="h-full bg-white"
                style={{
                  width: `${(completedCoreCount / Math.max(1, coreRequired.length)) * 100}%`,
                }}
              />
            </div>
            <ul className="mt-4 space-y-2">
              {PROJECT_ASSET_TYPES.map((req) => {
                const done = serverAssets.some(
                  (asset) => asset.type === req.type,
                );
                const isCore = coreRequired.some((c) => c.type === req.type);
                return (
                  <li
                    key={req.type}
                    className="flex items-center justify-between rounded-xl border border-[#2A3037] bg-[#0F1318] px-3 py-2"
                  >
                    <span className="text-sm text-white">
                      {req.label}
                      {!isCore ? (
                        <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-zinc-500">
                          Optional
                        </span>
                      ) : (
                        <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-amber-200/90">
                          Required
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {done ? (
                        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                          Completed
                        </span>
                      ) : null}
                      <button
                        type="button"
                        disabled={
                          assetUploadBusy || assetDeleteBusyType !== null
                        }
                        onClick={() => {
                          if (assetUploadBusy || assetDeleteBusyType) return;
                          setQuickUploadType(req.type);
                          quickUploadRef.current?.click();
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                          done ? "bg-zinc-700 text-zinc-100" : "bg-white text-canvas"
                        }`}
                      >
                        {quickAssetUploadBusy && quickUploadType === req.type
                          ? "Uploading…"
                          : done
                            ? "Replace"
                            : "Upload"}
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
              disabled={assetUploadBusy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || assetUploadBusy) return;
                setQuickAssetUploadBusy(true);
                setNotice(null);
                try {
                  await uploadProjectAssetFile(
                    project.id,
                    quickUploadType,
                    file,
                  );
                  await refreshAssets({ silent: true });
                  await refreshProject({ silent: true });
                } catch (err) {
                  setNotice(
                    err instanceof Error
                      ? err.message
                      : "Could not upload asset.",
                  );
                  e.currentTarget.value = "";
                  return;
                } finally {
                  setQuickAssetUploadBusy(false);
                }
                setTick((v) => v + 1);
                e.currentTarget.value = "";
              }}
            />
            <Link
              to={`/projects/${project.id}/subscription`}
              className={`mt-5 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold ${
                needsOnboarding || assetUploadBusy
                  ? "pointer-events-none cursor-not-allowed bg-zinc-700 text-zinc-400"
                  : "bg-white text-canvas"
              }`}
              onClick={(e) => {
                if (needsOnboarding || assetUploadBusy) e.preventDefault();
              }}
            >
              {assetUploadBusy ? "Uploading…" : "Continue to Subscription"}
            </Link>
            <p className="mt-3 text-center text-[11px] text-zinc-500">
              A valid subscription is required to activate the project.
            </p>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Invoices</h2>
          <Link
            to={`/projects/${project.id}/subscription`}
            className="text-xs font-semibold text-emerald-400/90 underline-offset-2 hover:underline"
          >
            Manage billing
          </Link>
        </div>
        {project.invoices.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No invoices yet for this project.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-[#2A3037]">
            <div className="grid grid-cols-12 bg-[#1C2126] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              <div className="col-span-4">Invoice</div>
              <div className="col-span-3">Amount</div>
              <div className="col-span-3">Date</div>
              <div className="col-span-2">Status</div>
            </div>
            {project.invoices.map((inv) => (
              <div
                key={inv.id}
                className="grid grid-cols-12 border-t border-[#2A3037] px-3 py-2.5 text-xs text-zinc-200"
              >
                <div className="col-span-4 font-medium">{inv.invoiceNumber}</div>
                <div className="col-span-3">{money(inv.amountCents, inv.currency)}</div>
                <div className="col-span-3">{fmtDate(inv.paidAt)}</div>
                <div className="col-span-2 capitalize">{inv.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        id="project-add-ons"
        className="scroll-mt-24 rounded-2xl border border-[#24292E] bg-[#15191C] p-5 shadow-glass"
      >
        <h2 className="text-3xl font-bold tracking-tight text-white">Add-ons</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Purchased add-ons stay on your subscription. Buy new extras individually through secure checkout.
        </p>

        {canBuyExtraEdits ? (
          <div className="mt-6">
            <article className="rounded-2xl border border-[#2A3037] bg-[#101317] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">Extra website edits</h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    {modalPerEditCents > 0
                      ? `From ${money(modalPerEditCents, extraEditSinglePurchAddon?.currency || "USD")} per edit`
                      : modalBundleCredits > 0 && modalBundleCents > 0
                        ? `Bundle: ${modalBundleCredits} edits for ${money(modalBundleCents, extraEditBundleAddon?.currency || "USD")}`
                        : "Plan-priced edit credits"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={addonCheckoutBusy}
                  onClick={() => setExtraEditModalOpen(true)}
                  className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Buy edit credits
                </button>
              </div>
            </article>
          </div>
        ) : null}

        {addonCatalog.some((a) => project.addons.includes(a.code)) ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Existing add-ons
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {addonCatalog
                .filter((addon) => project.addons.includes(addon.code))
                .map((addon) => (
                  <div
                    key={addon.code}
                    aria-disabled
                    className="cursor-not-allowed select-none rounded-2xl border border-[#2A3037] bg-[#101317] p-4 text-left opacity-70"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-lg font-semibold text-white">{addon.label}</p>
                      <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-100">
                        {money(addonCardDisplayCents(addon, plans, project.planId), addon.currency || "USD")}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">{addon.desc}</p>
                    {extraEditAddonCaption(addon, plans, project.planId) ? (
                      <p className="mt-1 text-[11px] font-medium text-zinc-500">
                        {extraEditAddonCaption(addon, plans, project.planId)}
                      </p>
                    ) : null}
                    {recurringSetupPriceBreakdown(addon, addon.currency || "USD")}
                    <span className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-[#2A3037] bg-[#1C2126] px-3 py-2 text-sm font-semibold text-zinc-500">
                      On your plan
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        {availableAddons.length > 0 ? (
          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Available add-ons
              </h3>
              {addonPageCount > 1 ? (
                <p className="text-xs text-zinc-500">
                  Page {addonPageSafe + 1} of {addonPageCount}
                </p>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {pagedAvailableAddons.map((addon) => (
                  <button
                    key={addon.code}
                    type="button"
                    disabled={!hasValidPlan || addonCheckoutBusy}
                    onClick={async () => {
                      if (!hasValidPlan) return;
                      setAddonCheckoutBusy(true);
                      setNotice(null);
                      try {
                        const base = `${window.location.origin}/projects/${project.id}`;
                        const { url } = await createAddonCheckoutSession(project.id, [addon.code], {
                          successUrl: base,
                          cancelUrl: base,
                        });
                        if (!url) {
                          setNotice("Could not start checkout for this add-on.");
                          return;
                        }
                        window.location.assign(url);
                      } catch (err) {
                        setNotice(
                          err instanceof Error ? err.message : "Could not start add-on checkout.",
                        );
                      } finally {
                        setAddonCheckoutBusy(false);
                      }
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      !hasValidPlan || addonCheckoutBusy
                        ? "cursor-not-allowed border-[#2A3037] bg-[#1C2126] text-zinc-500 opacity-50"
                        : "border-[#2A3037] bg-[#1C2126] text-white hover:border-zinc-400 active:scale-[0.99]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-lg font-semibold">{addon.label}</p>
                      <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-100">
                        {money(addonCardDisplayCents(addon, plans, project.planId), addon.currency || "USD")}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">{addon.desc}</p>
                    {extraEditAddonCaption(addon, plans, project.planId) ? (
                      <p className="mt-1 text-[11px] font-medium text-zinc-400">
                        {extraEditAddonCaption(addon, plans, project.planId)}
                      </p>
                    ) : null}
                    {recurringSetupPriceBreakdown(addon, addon.currency || "USD")}
                    <span className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-canvas transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">
                      {hasValidPlan ? "Purchase add-on" : "Subscribe to enable"}
                    </span>
                  </button>
                ))}
            </div>
            {addonPageCount > 1 ? (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={addonPageSafe <= 0}
                  onClick={() => setAddonPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-[#2A3037] bg-[#1C2126] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={addonPageSafe >= addonPageCount - 1}
                  onClick={() => setAddonPage((p) => Math.min(addonPageCount - 1, p + 1))}
                  className="rounded-lg border border-[#2A3037] bg-[#1C2126] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {addonCatalog.length === 0 ? (
          <p className="mt-4 rounded-xl border border-[#2A3037] bg-[#1C2126] px-4 py-3 text-sm text-zinc-400">
            No add-ons are available right now.
          </p>
        ) : null}
      </section>

      <ExtraEditPurchaseModal
        open={extraEditModalOpen}
        onClose={() => setExtraEditModalOpen(false)}
        projectId={project.id}
        plan={planForProject}
        usage={usage ?? undefined}
        singleAddon={extraEditSinglePurchAddon}
        bundleAddon={extraEditBundleAddon}
        currency={
          extraEditSinglePurchAddon?.currency ||
          extraEditBundleAddon?.currency ||
          "USD"
        }
        perEditCents={modalPerEditCents}
        bundleCredits={modalBundleCredits}
        bundleCents={modalBundleCents}
        busy={addonCheckoutBusy}
        setBusy={setAddonCheckoutBusy}
        onNotice={setNotice}
        baseReturnUrl={`${window.location.origin}/projects/${project.id}`}
      />
    </div>
  );
}
