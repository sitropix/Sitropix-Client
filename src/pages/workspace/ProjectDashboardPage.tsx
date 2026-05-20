import { Breadcrumb } from "@/components/Breadcrumb";
import { ProjectSetupDialog } from "@/components/workspace/ProjectSetupDialog";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  CORE_REQUIRED_PROJECT_ASSETS,
  PROJECT_ASSET_TYPES,
  getProjectById,
  hasValidProjectPlan,
} from "@/services/projectsStore";
import { formatBillingApiError } from "@/lib/billingErrors";
import {
  addonCardDisplayCents,
  addonRecurringUnitCents,
  defaultAddonRecurringCycle,
  extraEditAddonCaption,
  projectAddonCardPriceCents,
  projectAddonPriceSuffix,
} from "@/lib/addonDisplayHelpers";
import {
  confirmAddonCheckoutSession,
  createAddonCheckoutSession,
  ensureBillingCustomer,
} from "@/services/subscriptionsApi";
import { AddonPurchaseDialog } from "@/components/billing/AddonPurchaseDialog";
import {
  AddonBillingCycleToggle,
  AddonOfferCard,
  AddonRecurringPriceBreakdown,
} from "@/components/billing/addonDisplay";
import { ExtraEditPurchaseModal } from "@/components/billing/ExtraEditPurchaseModal";
import { portal as portalUi } from "@/components/portal/portalStyles";
import { isCreditPackAddon } from "@/constants/extraEditAddons";
import { formatFileSize } from "@/lib/formatFileSize";
import {
  deleteProjectAssetFile,
  downloadProjectAssetFromServer,
  fetchProjectAssets,
  uploadProjectAssetFile,
  type ProjectAssetUploadRow,
} from "@/services/subscriptionsApi";
import type { BillingCycle } from "@/types/subscription";
import type { ProjectAddonCard, ProjectRecord, ProjectRequirementType } from "@/types/project";
import type { SubscriptionAddon } from "@/types/subscription";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

const ADDONS_PAGE_SIZE = 6;

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
  const plans = useMemo(() => portal?.plans ?? [], [portal?.plans]);
  const addonCatalog = useMemo(() => portal?.addons ?? [], [portal?.addons]);
  const purchasableAddons = useMemo(
    () => addonCatalog.filter((a) => !isCreditPackAddon(a)),
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
  const [rawProject, setRawProject] = useState<ProjectRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [addonCheckoutBusy, setAddonCheckoutBusy] = useState(false);
  const [extraEditModalOpen, setExtraEditModalOpen] = useState(false);
  const [addonPurchaseTarget, setAddonPurchaseTarget] = useState<SubscriptionAddon | null>(
    null,
  );
  const [addonCheckoutError, setAddonCheckoutError] = useState<string | null>(null);
  const [addonBillingPreparing, setAddonBillingPreparing] = useState(false);
  const [assetFormUploadBusy, setAssetFormUploadBusy] = useState(false);
  const assetUploadBusy = assetFormUploadBusy;
  const [assetDownloadBusyType, setAssetDownloadBusyType] =
    useState<ProjectRequirementType | null>(null);
  const [assetDeleteBusyType, setAssetDeleteBusyType] =
    useState<ProjectRequirementType | null>(null);
  const [setupOverlayDismissed, setSetupOverlayDismissed] = useState(false);
  const [addonRecurringCycle, setAddonRecurringCycle] = useState<BillingCycle>("monthly");
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

  useEffect(() => {
    setSetupOverlayDismissed(false);
    setNotice(null);
    setAddonCheckoutError(null);
  }, [projectId]);

  useEffect(() => {
    if (!addonPurchaseTarget || !ownedProject || !hasValidProjectPlan(ownedProject)) return;
    let cancelled = false;
    setAddonBillingPreparing(true);
    setAddonCheckoutError(null);
    void ensureBillingCustomer(ownedProject.id)
      .catch((err) => {
        if (!cancelled) {
          setAddonCheckoutError(
            formatBillingApiError(err, "Could not prepare billing for this purchase."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setAddonBillingPreparing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addonPurchaseTarget?.code, ownedProject?.id]);

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
  const showSetupOverlay = assetsReady && !hasValidPlan && !setupOverlayDismissed;
  const accessible = ownedProject?.accessibleAddons;
  const purchasableCards = accessible?.purchasable ?? [];
  const existingCards = accessible?.existing ?? [];
  const canChooseAddonCycle = accessible?.billingContext?.canChooseRecurringAddonCycle ?? false;

  const addonByCode = useMemo(
    () => new Map(purchasableAddons.map((a) => [a.code, a])),
    [purchasableAddons],
  );

  const cardByCode = useMemo(() => {
    const map = new Map<string, ProjectAddonCard>();
    for (const card of [...existingCards, ...purchasableCards]) {
      map.set(card.code, card);
    }
    return map;
  }, [existingCards, purchasableCards]);

  const availableAddons = useMemo(
    () =>
      purchasableCards
        .map((card) => addonByCode.get(card.code))
        .filter((a): a is SubscriptionAddon => Boolean(a)),
    [purchasableCards, addonByCode],
  );

  const ownedAddonCards = useMemo(
    () =>
      existingCards
        .map((card) => addonByCode.get(card.code))
        .filter((a): a is SubscriptionAddon => Boolean(a)),
    [existingCards, addonByCode],
  );

  useEffect(() => {
    if (!ownedProject) return;
    setAddonRecurringCycle(
      defaultAddonRecurringCycle(ownedProject.billingCycle, purchasableCards),
    );
  }, [ownedProject?.id, ownedProject?.billingCycle, purchasableCards]);
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
  const effectiveAddonCycle: BillingCycle = canChooseAddonCycle
    ? addonRecurringCycle
    : project.billingCycle === "yearly"
      ? "yearly"
      : "monthly";
  const extraEditPurchase = project.extraEditPurchase;
  const modalPerEditCents = extraEditPurchase?.perEditCents ?? 0;
  const modalBundleCredits = extraEditPurchase?.bundleCredits ?? 0;
  const modalBundleCents = extraEditPurchase?.bundleCents ?? 0;
  const canBuyExtraEdits = hasValidPlan && (extraEditPurchase?.available ?? false);
  const extraEditSinglePurchAddon: SubscriptionAddon | undefined = extraEditPurchase?.singleAddonCode
    ? { code: extraEditPurchase.singleAddonCode, label: "", desc: "", priceCents: modalPerEditCents }
    : undefined;
  const extraEditBundleAddon: SubscriptionAddon | undefined = extraEditPurchase?.bundleAddonCode
    ? { code: extraEditPurchase.bundleAddonCode, label: "", desc: "", priceCents: modalBundleCents }
    : undefined;

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
          <Link
            to={`/projects/${project.id}/add-ons`}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-600 bg-[#1C2126] px-4 py-2 text-sm font-semibold text-white transition hover:border-zinc-400 hover:bg-[#232a32]"
          >
            <IconPuzzle className="h-4 w-4 shrink-0 text-zinc-300" />
            Manage Add-ons
          </Link>
          <button
            type="button"
            onClick={() => setNotice("Project settings panel will be available soon.")}
            className="rounded-xl border border-zinc-600 bg-[#1C2126] px-4 py-2 text-sm font-semibold text-white transition hover:border-zinc-400 hover:bg-[#232a32]"
          >
            Project Settings
          </button>
          <Link
            to="/requests"
            className={portalUi.btnDark + " !rounded-xl !px-4 !py-2 !text-sm"}
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
              className={`${portalUi.btnPrimary} cursor-pointer !rounded-xl !px-4 !py-2 !text-sm ${
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
                    <p className="truncate text-sm font-semibold text-on-surface">{asset.fileName}</p>
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
              className="rounded-xl border border-[#2A3037] bg-[#1C2126] px-3 py-2 text-sm text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              {PROJECT_ASSET_TYPES.map((req) => (
                <option key={req.type} value={req.type}>
                  {req.label}
                </option>
              ))}
            </select>
            <div className="rounded-xl border border-[#2A3037] bg-[#1C2126] px-3 py-2 text-xs text-on-surface-variant">
              <span className={assetFile ? "text-on-surface" : undefined}>
                {assetFile ? assetFile.name : "No file selected"}
              </span>
            </div>
            <button
              type="submit"
              disabled={!assetFile || assetUploadBusy}
              aria-busy={assetFormUploadBusy}
              className={portalUi.btnPrimary + " !rounded-xl !px-4 !py-2 !text-sm disabled:cursor-not-allowed disabled:opacity-40"}
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

      <ProjectSetupDialog
        project={ownedProject}
        open={showSetupOverlay && Boolean(ownedProject)}
        onClose={() => setSetupOverlayDismissed(true)}
        assets={serverAssets}
        assetsLoading={assetsLoading}
        onAssetsUpdated={async () => {
          await refreshAssets({ silent: true });
          await refreshProject({ silent: true });
          setTick((v) => v + 1);
        }}
      />

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

      <section id="project-add-ons" className={`${portalUi.panel} scroll-mt-24`}>
        <h2 className={portalUi.pageTitle}>Add-ons</h2>
        <p className={portalUi.pageSubtitle}>
          Purchased add-ons stay on your subscription. Buy new extras individually through secure checkout.
        </p>
        {canBuyExtraEdits ? (
          <div className="mt-6">
            <article className={portalUi.addonCard}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-body text-body-lg font-semibold text-on-surface">Extra website edits</h3>
                  <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                    {modalPerEditCents > 0
                      ? `From ${money(modalPerEditCents, extraEditPurchase?.currency ?? "USD")} per edit`
                      : modalBundleCredits > 0 && modalBundleCents > 0
                        ? `Bundle: ${modalBundleCredits} edits for ${money(modalBundleCents, extraEditPurchase?.currency ?? "USD")}`
                        : "Plan-priced edit credits"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={addonCheckoutBusy}
                  onClick={() => setExtraEditModalOpen(true)}
                  className={portalUi.btnPrimary + " shrink-0 !px-4 !py-2 !text-sm"}
                >
                  Buy edit credits
                </button>
              </div>
            </article>
          </div>
        ) : null}

        {ownedAddonCards.length > 0 ? (
          <div className="mt-6">
            <h3 className={portalUi.addonSectionEyebrow}>Existing add-ons</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ownedAddonCards.map((addon) => {
                const card = cardByCode.get(addon.code);
                const ownedCycle =
                  project.billingCycle === "yearly" ? "yearly" : "monthly";
                const priceCents = card
                  ? projectAddonCardPriceCents(card, addon, planForProject, ownedCycle)
                  : addonCardDisplayCents(addon, plans, project.planId, ownedCycle);
                return (
                  <AddonOfferCard
                    key={addon.code}
                    mode="owned"
                    label={addon.label}
                    description={addon.desc}
                    priceLabel={money(priceCents, addon.currency || "USD")}
                    caption={extraEditAddonCaption(addon, plans, project.planId)}
                    breakdown={
                      <AddonRecurringPriceBreakdown
                        addon={addon}
                        currency={addon.currency || "USD"}
                        billingCycle={ownedCycle}
                        recurringCents={addonRecurringUnitCents(
                          addon,
                          planForProject,
                          ownedCycle,
                        )}
                      />
                    }
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        {availableAddons.length > 0 ? (
          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className={portalUi.addonSectionEyebrow}>Available add-ons</h3>
              <div className="flex flex-wrap items-center gap-3">
                {canChooseAddonCycle ? (
                  <AddonBillingCycleToggle
                    value={addonRecurringCycle}
                    onChange={setAddonRecurringCycle}
                    disabled={addonCheckoutBusy}
                  />
                ) : null}
                {addonPageCount > 1 ? (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Page {addonPageSafe + 1} of {addonPageCount}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pagedAvailableAddons.map((addon) => {
                const card = cardByCode.get(addon.code);
                const priceCents = card
                  ? projectAddonCardPriceCents(
                      card,
                      addon,
                      planForProject,
                      effectiveAddonCycle,
                    )
                  : addonCardDisplayCents(
                      addon,
                      plans,
                      project.planId,
                      effectiveAddonCycle,
                    );
                return (
                  <AddonOfferCard
                    key={addon.code}
                    mode="purchase"
                    label={addon.label}
                    description={addon.desc}
                    priceLabel={money(priceCents, addon.currency || "USD")}
                    priceSuffix={projectAddonPriceSuffix(addon, effectiveAddonCycle)}
                    caption={extraEditAddonCaption(addon, plans, project.planId)}
                    breakdown={
                      <AddonRecurringPriceBreakdown
                        addon={addon}
                        currency={addon.currency || "USD"}
                        billingCycle={effectiveAddonCycle}
                        recurringCents={addonRecurringUnitCents(
                          addon,
                          planForProject,
                          effectiveAddonCycle,
                        )}
                      />
                    }
                    disabled={addonCheckoutBusy}
                    actionLabel={
                      addonCheckoutBusy
                        ? "Starting checkout…"
                        : hasValidPlan
                          ? "Purchase add-on"
                          : "Subscribe to enable"
                    }
                    onPress={() => {
                      if (!hasValidPlan) {
                        navigate(`/projects/${project.id}/subscription`);
                        return;
                      }
                      setAddonCheckoutError(null);
                      setNotice(null);
                      setAddonPurchaseTarget(addon);
                    }}
                  />
                );
              })}

            </div>
            {addonPageCount > 1 ? (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={addonPageSafe <= 0}
                  onClick={() => setAddonPage((p) => Math.max(0, p - 1))}
                  className={portalUi.btnSecondary + " !px-3 !py-1.5 !text-xs"}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={addonPageSafe >= addonPageCount - 1}
                  onClick={() => setAddonPage((p) => Math.min(addonPageCount - 1, p + 1))}
                  className={portalUi.btnSecondary + " !px-3 !py-1.5 !text-xs"}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {!canBuyExtraEdits &&
        ownedAddonCards.length === 0 &&
        availableAddons.length === 0 &&
        hasValidPlan ? (
          <p className="mt-4 rounded-lg border border-on-surface/10 bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
            No add-ons are available for your plan and billing cycle.
          </p>
        ) : null}
      </section>

      <AddonPurchaseDialog
        open={addonPurchaseTarget !== null}
        addon={addonPurchaseTarget}
        project={project}
        priceLabel={
          addonPurchaseTarget
            ? money(
                (() => {
                  const card = cardByCode.get(addonPurchaseTarget.code);
                  return card
                    ? projectAddonCardPriceCents(
                        card,
                        addonPurchaseTarget,
                        planForProject,
                        effectiveAddonCycle,
                      )
                    : addonCardDisplayCents(
                        addonPurchaseTarget,
                        plans,
                        project.planId,
                        effectiveAddonCycle,
                      );
                })(),
                addonPurchaseTarget.currency || "USD",
              )
            : ""
        }
        dueTodayCents={
          addonPurchaseTarget
            ? (() => {
                const card = cardByCode.get(addonPurchaseTarget.code);
                return card
                  ? projectAddonCardPriceCents(
                      card,
                      addonPurchaseTarget,
                      planForProject,
                      effectiveAddonCycle,
                    )
                  : addonCardDisplayCents(
                      addonPurchaseTarget,
                      plans,
                      project.planId,
                      effectiveAddonCycle,
                    );
              })()
            : 0
        }
        currency={addonPurchaseTarget?.currency || "USD"}
        caption={
          addonPurchaseTarget
            ? extraEditAddonCaption(addonPurchaseTarget, plans, project.planId)
            : null
        }
        breakdownAddon={addonPurchaseTarget}
        busy={addonCheckoutBusy}
        preparing={addonBillingPreparing}
        errorMessage={addonCheckoutError}
        onClose={() => {
          setAddonPurchaseTarget(null);
          setAddonCheckoutError(null);
        }}
        onConfirm={async () => {
          if (!addonPurchaseTarget || !hasValidPlan) return;
          setAddonCheckoutBusy(true);
          setAddonCheckoutError(null);
          try {
            await ensureBillingCustomer(project.id);
            const base = `${window.location.origin}/projects/${project.id}`;
            const { url } = await createAddonCheckoutSession(
              project.id,
              [addonPurchaseTarget.code],
              {
                successUrl: base,
                cancelUrl: base,
                ...(canChooseAddonCycle &&
                addonPurchaseTarget.billingKind === "recurring"
                  ? { addonRecurringCycle: effectiveAddonCycle }
                  : {}),
              },
            );
            if (!url) {
              setAddonCheckoutError("Could not start checkout for this add-on.");
              return;
            }
            window.location.assign(url);
          } catch (err) {
            setAddonCheckoutError(
              formatBillingApiError(err, "Could not start add-on checkout."),
            );
          } finally {
            setAddonCheckoutBusy(false);
          }
        }}
      />

      <ExtraEditPurchaseModal
        open={extraEditModalOpen}
        onClose={() => setExtraEditModalOpen(false)}
        projectId={project.id}
        projectName={project.name}
        plan={planForProject}
        usage={usage ?? undefined}
        singleAddon={extraEditSinglePurchAddon}
        bundleAddon={extraEditBundleAddon}
        currency={extraEditPurchase?.currency ?? "USD"}
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
