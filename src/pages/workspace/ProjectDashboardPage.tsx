import { ProjectSetupDialog } from "@/components/workspace/ProjectSetupDialog";
import { useAuth } from "@/context/AuthContext";
import { useUser } from "@/context/UserContext";
import {
  CORE_REQUIRED_PROJECT_ASSETS,
  PROJECT_ASSET_TYPES,
  getProjectById,
  hasValidProjectPlan,
} from "@/services/projectsStore";
import {
  addonCardDisplayCents,
  addonRecurringUnitCents,
  defaultAddonRecurringCycle,
  extraEditAddonCaption,
  projectAddonCardPriceCents,
  projectAddonPriceSuffix,
} from "@/lib/addonDisplayHelpers";
import {
  addonFulfillmentCaption,
  submitTicketUrlForAddon,
} from "@/lib/addonUtilizationDisplay";
import {
  buildAddonCheckoutCartFromAddons,
  saveAddonCheckoutCart,
} from "@/services/addonCheckoutCart";
import { confirmAddonCheckoutSession } from "@/services/subscriptionsApi";
import {
  AddonBillingCycleToggle,
  AddonOfferCard,
  AddonRecurringPriceBreakdown,
} from "@/components/billing/addonDisplay";
import { ExtraEditPurchaseModal } from "@/components/billing/ExtraEditPurchaseModal";
import {
  DOCUMENT_MAX_BYTES,
  PROJECT_ASSET_MAX_PER_TYPE,
  documentMaxSizeLabelMb,
} from "@/lib/documentLimits";
import { formatFileSize } from "@/lib/formatFileSize";
import { userFacingApiError } from "@/services/http";
import {
  deleteProjectAssetFile,
  downloadProjectAssetFromServer,
  fetchProjectAssets,
  uploadProjectAssetFile,
  type ProjectAssetUploadRow,
} from "@/services/subscriptionsApi";
import type { BillingCycle } from "@/types/subscription";
import type {
  ProjectAddonCard,
  ProjectRecord,
  ProjectRequirementType,
} from "@/types/project";
import type { SubscriptionAddon } from "@/types/subscription";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxEmptyState } from "@/components/sx/EmptyState";
import { SxMetricCard } from "@/components/sx/MetricCard";
import { SxPageHeader } from "@/components/sx/PageHeader";
import { SxPanel } from "@/components/sx/Panel";
import { SxSelect } from "@/components/sx/Input";
import { useSxToast } from "@/components/sx/Toast";

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

function daysUntilReset(planValidUntil: string | null): number | null {
  if (!planValidUntil) return null;
  const end = new Date(planValidUntil).getTime();
  if (!Number.isFinite(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86400000);
}

function statusBadgeVariant(status: string) {
  if (status === "active") return "success" as const;
  if (status === "on_hold") return "warning" as const;
  return "neutral" as const;
}

function statusLabel(status: string) {
  if (status === "active") return "Active";
  if (status === "on_hold") return "On hold";
  return "Not started";
}

export function ProjectDashboardPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { portal } = useUser();
  const toast = useSxToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const plans = useMemo(() => portal?.plans ?? [], [portal?.plans]);
  const [addonPage, setAddonPage] = useState(0);
  const userId = user?.id ?? portal?.user?.id ?? "guest-user";
  const [, setTick] = useState(0);
  const [serverAssets, setServerAssets] = useState<ProjectAssetUploadRow[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetType, setAssetType] =
    useState<ProjectRequirementType>("requirements");
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [rawProject, setRawProject] = useState<ProjectRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [addonCheckoutBusy, setAddonCheckoutBusy] = useState(false);
  const [extraEditModalOpen, setExtraEditModalOpen] = useState(false);
  const [assetFormUploadBusy, setAssetFormUploadBusy] = useState(false);
  const assetUploadBusy = assetFormUploadBusy;
  const [assetDownloadBusyId, setAssetDownloadBusyId] = useState<string | null>(
    null,
  );
  const [assetDeleteBusyId, setAssetDeleteBusyId] = useState<string | null>(
    null,
  );
  const [setupOverlayDismissed, setSetupOverlayDismissed] = useState(false);
  const [addonRecurringCycle, setAddonRecurringCycle] =
    useState<BillingCycle>("monthly");
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
  }, [projectId]);

  const addonFunnel = searchParams.get("subscriptionFunnel");
  const addonSessionId = searchParams.get("session_id");
  const addonProjectParam = searchParams.get("projectId");

  useEffect(() => {
    if (addonFunnel !== "addon_checkout_return") return;
    if (!addonSessionId || !addonProjectParam || addonProjectParam !== projectId)
      return;
    if (addonReturnHandledRef.current === addonSessionId) return;
    addonReturnHandledRef.current = addonSessionId;
    void (async () => {
      try {
        await confirmAddonCheckoutSession(projectId, addonSessionId);
        navigate(
          {
            pathname: "/projects",
            search: "?payment_success=1&payment_source=addon",
          },
          { replace: true },
        );
        return;
      } catch (err) {
        toast.error(
          "Couldn't confirm add-on purchase.",
          err instanceof Error ? err.message : undefined,
        );
      }
      setSearchParams({}, { replace: true });
    })();
  }, [
    addonFunnel,
    addonSessionId,
    addonProjectParam,
    projectId,
    setSearchParams,
    navigate,
    toast,
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
      toast.error("Couldn't load project files.");
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
  const needsOnboarding =
    assetsReady && completedCoreCount < coreRequired.length;
  const assetsForSelectedType = serverAssets.filter(
    (a) => a.type === assetType,
  );
  const selectedTypeAtLimit =
    assetsForSelectedType.length >= PROJECT_ASSET_MAX_PER_TYPE;
  const hasValidPlan = ownedProject ? hasValidProjectPlan(ownedProject) : false;
  const showSetupOverlay =
    assetsReady && !hasValidPlan && !setupOverlayDismissed;
  const accessible = ownedProject?.accessibleAddons;
  const purchasableCards = accessible?.purchasable ?? [];
  const existingCards = accessible?.existing ?? [];
  const canChooseAddonCycle =
    accessible?.billingContext?.canChooseRecurringAddonCycle ?? false;

  const addonByCode = useMemo(
    () => new Map((portal?.addons ?? []).map((a) => [a.code, a])),
    [portal?.addons],
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

  useEffect(() => {
    if (!ownedProject) return;
    setAddonRecurringCycle(
      defaultAddonRecurringCycle(ownedProject.billingCycle, purchasableCards),
    );
  }, [ownedProject?.id, ownedProject?.billingCycle, purchasableCards]);

  const addonPageCount = Math.max(
    1,
    Math.ceil(availableAddons.length / ADDONS_PAGE_SIZE),
  );
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
    return (
      <div className="p-6 text-sx-sm text-[var(--text-tertiary)]">
        Loading project…
      </div>
    );
  }
  const project = ownedProject;
  const resetDays = daysUntilReset(project.planValidUntil);
  const usage = project.usage;
  const editCap = usage?.includedCreditsPerPeriod ?? 0;
  const editUsed = usage?.includedCreditsUsedThisPeriod ?? 0;
  const editsRemaining = Math.max(0, editCap - editUsed);
  const purchasedBal = usage?.purchasedCreditsBalance ?? 0;
  const includedDepleted = editCap > 0 && editUsed >= editCap;
  const pagesMax = usage?.pagesIncludedMax ?? null;
  const pagesUsed = usage?.pagesUsed ?? 0;
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
  const canBuyExtraEdits =
    hasValidPlan && (extraEditPurchase?.available ?? false);
  const extraEditSinglePurchAddon: SubscriptionAddon | undefined = extraEditPurchase?.singleAddonCode
    ? {
        code: extraEditPurchase.singleAddonCode,
        label: "",
        desc: "",
        priceCents: modalPerEditCents,
      }
    : undefined;
  const extraEditBundleAddon: SubscriptionAddon | undefined = extraEditPurchase?.bundleAddonCode
    ? {
        code: extraEditPurchase.bundleAddonCode,
        label: "",
        desc: "",
        priceCents: modalBundleCents,
      }
    : undefined;

  return (
    <div data-sx-root className="flex flex-col gap-6">
      <SxPageHeader
        eyebrow={
          <span className="font-mono">
            Project · {project.id.slice(-6).toUpperCase()}
          </span>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {project.name}
            <SxBadge variant={statusBadgeVariant(project.subscriptionStatus)}>
              {statusLabel(project.subscriptionStatus)}
            </SxBadge>
          </span>
        }
        description={
          project.planName
            ? `${project.planName} · Renews ${fmtDate(project.planValidUntil)}`
            : "No plan yet. Pick one to start receiving edits."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`/projects/${project.id}/add-ons`}>
              <SxButton variant="secondary">Manage add-ons</SxButton>
            </Link>
            <Link to="/tickets/new">
              <SxButton variant="primary">New ticket</SxButton>
            </Link>
          </div>
        }
      />

      {/* Metric strip */}
      <section
        aria-label="Project usage"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <SxMetricCard
          label="Edit credits"
          value={
            usage ? (
              <>
                {editsRemaining}
                <small className="ml-1 font-ui text-sx-sm font-normal text-[var(--text-tertiary)]">
                  of {editCap}
                </small>
              </>
            ) : (
              "—"
            )
          }
          progress={editCap > 0 ? editUsed / editCap : undefined}
          meta={
            usage ? (
              includedDepleted ? (
                <SxBadge variant="urgent">All included edits used</SxBadge>
              ) : purchasedBal > 0 ? (
                <span>
                  +{purchasedBal} purchased credit
                  {purchasedBal === 1 ? "" : "s"}
                </span>
              ) : resetDays != null ? (
                <span>Resets in {resetDays} day{resetDays === 1 ? "" : "s"}</span>
              ) : (
                <span>This billing cycle</span>
              )
            ) : (
              <span>Usage syncs in a moment.</span>
            )
          }
        />

        {pagesMax != null && pagesMax > 0 ? (
          <SxMetricCard
            label="Pages used"
            value={
              <>
                {pagesUsed}
                <small className="ml-1 font-ui text-sx-sm font-normal text-[var(--text-tertiary)]">
                  of {pagesMax}
                </small>
              </>
            }
            progress={pagesUsed / pagesMax}
          />
        ) : (
          <SxMetricCard
            label="Plan"
            value={project.planName ?? "—"}
            meta={
              <span>
                {project.billingCycle === "yearly" ? "Yearly" : "Monthly"}
                {resetDays != null
                  ? ` · Renews in ${resetDays}d`
                  : ""}
              </span>
            }
          />
        )}

        <SxMetricCard
          label="Invoices"
          value={project.invoices.length}
          meta={
            <Link
              to={`/projects/${project.id}/plan`}
              className="font-semibold text-[var(--text-brand)] hover:underline"
            >
              Manage billing →
            </Link>
          }
        />
      </section>

      {/* Buy extra edits banner */}
      {canBuyExtraEdits && includedDepleted ? (
        <div className="flex flex-col gap-3 rounded-sx-md border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-bg)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sx-sm text-[var(--color-warning-fg)]">
            You've used all included edits for this cycle. Buy extra credits at your plan rate.
          </p>
          <SxButton
            variant="secondary"
            size="sm"
            onClick={() => setExtraEditModalOpen(true)}
            disabled={addonCheckoutBusy}
          >
            {addonCheckoutBusy ? "Starting…" : "Buy edit credits"}
          </SxButton>
        </div>
      ) : null}

      {/* Files */}
      <SxPanel
        title="Project files"
        action={
          <span className="font-mono text-sx-xs text-[var(--text-tertiary)]">
            up to {PROJECT_ASSET_MAX_PER_TYPE} per type · {documentMaxSizeLabelMb()} each
          </span>
        }
      >
        <div className="flex flex-col gap-4">
          {assetsLoading ? (
            <p className="rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-3 text-sx-sm text-[var(--text-tertiary)]">
              Loading files…
            </p>
          ) : serverAssets.length === 0 ? (
            <SxEmptyState
              title="No files yet."
              description="Upload requirement docs and brand assets so we can get to work."
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)] rounded-sx-md border border-[var(--border-subtle)]">
              {serverAssets.map((asset) => (
                <li
                  key={`${asset.type}:${asset.id}`}
                  className="flex flex-col items-start justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-ui text-sx-sm font-medium text-[var(--text-primary)]">
                      {asset.fileName}
                    </p>
                    <p className="mt-0.5 font-mono text-sx-2xs text-[var(--text-tertiary)]">
                      {formatFileSize(asset.sizeBytes)} ·{" "}
                      {prettyAssetType(asset.type)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SxButton
                      variant="secondary"
                      size="sm"
                      disabled={
                        assetUploadBusy ||
                        assetDeleteBusyId !== null ||
                        assetDownloadBusyId === asset.id
                      }
                      onClick={async () => {
                        setAssetDownloadBusyId(asset.id);
                        try {
                          await downloadProjectAssetFromServer(
                            project.id,
                            asset.id,
                          );
                        } catch {
                          toast.error("Couldn't download file.");
                        } finally {
                          setAssetDownloadBusyId(null);
                        }
                      }}
                    >
                      {assetDownloadBusyId === asset.id
                        ? "Downloading…"
                        : "Download"}
                    </SxButton>
                    <SxButton
                      variant="ghost"
                      size="sm"
                      className="!text-[var(--color-danger-fg)]"
                      disabled={
                        assetUploadBusy || assetDeleteBusyId !== null
                      }
                      onClick={async () => {
                        setAssetDeleteBusyId(asset.id);
                        try {
                          await deleteProjectAssetFile(project.id, asset.id);
                          await refreshAssets({ silent: true });
                          toast.success("File removed.");
                        } catch (err) {
                          toast.error(
                            "Couldn't remove file.",
                            err instanceof Error ? err.message : undefined,
                          );
                        } finally {
                          setAssetDeleteBusyId(null);
                        }
                        setTick((v) => v + 1);
                      }}
                    >
                      Remove
                    </SxButton>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form
            className="grid gap-3 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!assetFile || assetUploadBusy || selectedTypeAtLimit) return;
              if (assetFile.size > DOCUMENT_MAX_BYTES) {
                toast.error(
                  `${assetFile.name} is too large.`,
                  `Files must be under ${documentMaxSizeLabelMb()}.`,
                );
                return;
              }
              setAssetFormUploadBusy(true);
              try {
                await uploadProjectAssetFile(
                  project.id,
                  assetType,
                  assetFile,
                );
                await refreshAssets({ silent: true });
                await refreshProject({ silent: true });
                toast.success("File uploaded.");
              } catch (err) {
                toast.error(
                  "Couldn't upload file.",
                  userFacingApiError(err, "Try a smaller file or a different format."),
                );
                return;
              } finally {
                setAssetFormUploadBusy(false);
              }
              setAssetFile(null);
              setTick((v) => v + 1);
            }}
          >
            <SxSelect
              label="File type"
              hideLabel
              value={assetType}
              onChange={(e) =>
                setAssetType(e.target.value as ProjectRequirementType)
              }
              disabled={assetUploadBusy}
            >
              {PROJECT_ASSET_TYPES.map((req) => (
                <option key={req.type} value={req.type}>
                  {req.label}
                </option>
              ))}
            </SxSelect>

            <label
              className={[
                "flex h-[38px] cursor-pointer items-center gap-2 rounded-sx-md border border-dashed px-3 text-sx-sm",
                "border-[var(--border-default)] bg-[var(--surface-sunken)] text-[var(--text-secondary)]",
                "hover:border-[var(--border-strong)]",
                assetUploadBusy || assetDeleteBusyId
                  ? "pointer-events-none opacity-50"
                  : "",
              ].join(" ")}
            >
              <span className="truncate">
                {assetFile ? assetFile.name : "Choose a file…"}
              </span>
              <input
                type="file"
                disabled={
                  assetUploadBusy ||
                  assetDeleteBusyId !== null ||
                  selectedTypeAtLimit
                }
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && file.size > DOCUMENT_MAX_BYTES) {
                    toast.error(
                      `${file.name} is too large.`,
                      `Files must be under ${documentMaxSizeLabelMb()}.`,
                    );
                    e.currentTarget.value = "";
                    return;
                  }
                  setAssetFile(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <SxButton
              type="submit"
              disabled={!assetFile || assetUploadBusy || selectedTypeAtLimit}
              loading={assetFormUploadBusy}
            >
              {assetFormUploadBusy ? "Saving…" : "Upload"}
            </SxButton>
          </form>

          {needsOnboarding ? (
            <p className="rounded-sx-md border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-bg)] px-3 py-2 text-sx-xs text-[var(--color-warning-fg)]">
              Required setup {completedCoreCount}/{coreRequired.length} — upload requirement docs and branding to continue.
            </p>
          ) : null}
        </div>
      </SxPanel>

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

      {/* Invoices */}
      <SxPanel
        title="Project invoices"
        action={
          <Link
            to={`/projects/${project.id}/plan`}
            className="text-sx-xs font-semibold text-[var(--text-brand)] hover:underline"
          >
            Manage billing →
          </Link>
        }
        padded={project.invoices.length === 0}
        bodyClassName={project.invoices.length === 0 ? "" : "p-0"}
      >
        {project.invoices.length === 0 ? (
          <p className="text-sx-sm text-[var(--text-tertiary)]">
            No invoices yet for this project.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sx-sm">
              <thead>
                <tr className="bg-[var(--surface-sunken)] text-left">
                  <th className="px-4 py-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium">
                    Invoice
                  </th>
                  <th className="px-4 py-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium">
                    Amount
                  </th>
                  <th className="px-4 py-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium">
                    Date
                  </th>
                  <th className="px-4 py-3 font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)] font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {project.invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-t border-[var(--border-subtle)]"
                  >
                    <td className="px-4 py-3 font-mono text-sx-xs text-[var(--text-primary)]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-sx-xs text-[var(--text-primary)]">
                      {money(inv.amountCents, inv.currency)}
                    </td>
                    <td className="px-4 py-3 font-mono text-sx-xs text-[var(--text-tertiary)]">
                      {fmtDate(inv.paidAt)}
                    </td>
                    <td className="px-4 py-3 text-sx-xs">
                      <SxBadge
                        variant={
                          inv.status === "succeeded"
                            ? "success"
                            : inv.status === "failed"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {inv.status === "succeeded"
                          ? "Paid"
                          : inv.status}
                      </SxBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SxPanel>

      {/* Add-ons */}
      <SxPanel
        title="Add-ons"
        action={
          availableAddons.length > 0 && canChooseAddonCycle ? (
            <AddonBillingCycleToggle
              value={addonRecurringCycle}
              onChange={setAddonRecurringCycle}
              disabled={addonCheckoutBusy}
            />
          ) : null
        }
      >
        {canBuyExtraEdits ? (
          <div className="mb-4 flex flex-col gap-3 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-ui text-sx-sm font-semibold text-[var(--text-primary)]">
                Extra edit credits
              </p>
              <p className="mt-1 text-sx-xs text-[var(--text-secondary)]">
                {modalPerEditCents > 0
                  ? `From ${money(modalPerEditCents, extraEditPurchase?.currency ?? "USD")} per edit`
                  : modalBundleCredits > 0 && modalBundleCents > 0
                    ? `Bundle: ${modalBundleCredits} edits for ${money(modalBundleCents, extraEditPurchase?.currency ?? "USD")}`
                    : "Plan-priced edit credits"}
              </p>
            </div>
            <SxButton
              variant="primary"
              size="sm"
              onClick={() => setExtraEditModalOpen(true)}
              disabled={addonCheckoutBusy}
            >
              Buy credits
            </SxButton>
          </div>
        ) : null}

        {existingCards.length > 0 ? (
          <div className="mb-6">
            <h3 className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              Active on this project
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {existingCards.map((card) => {
                const addon = addonByCode.get(card.code);
                if (!addon) return null;
                const ownedCycle =
                  project.billingCycle === "yearly" ? "yearly" : "monthly";
                const priceCents = projectAddonCardPriceCents(
                  card,
                  addon,
                  planForProject,
                  ownedCycle,
                );
                const fulfillment = card.fulfillment ?? null;
                const statusCaption = fulfillment?.tracksFulfillment
                  ? addonFulfillmentCaption(fulfillment, project.id)
                  : extraEditAddonCaption(addon, plans, project.planId);
                const addonId = addon.id ?? "";
                let fulfillmentAction: ReactNode = null;
                if (fulfillment?.status === "not_used" && addonId) {
                  fulfillmentAction = (
                    <Link to={submitTicketUrlForAddon(project.id, addonId)}>
                      <SxButton variant="primary" size="sm">
                        Start request
                      </SxButton>
                    </Link>
                  );
                } else if (
                  fulfillment?.status === "in_progress" &&
                  fulfillment.activeTicketId
                ) {
                  fulfillmentAction = (
                    <Link to={`/tickets/${fulfillment.activeTicketId}`}>
                      <SxButton variant="secondary" size="sm">
                        View ticket
                      </SxButton>
                    </Link>
                  );
                }
                return (
                  <AddonOfferCard
                    key={card.code}
                    mode="owned"
                    label={addon.label}
                    description={addon.desc}
                    priceLabel={money(priceCents, addon.currency || "USD")}
                    caption={statusCaption}
                    fulfillment={fulfillment}
                    fulfillmentAction={fulfillmentAction}
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
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                Available add-ons
              </h3>
              {addonPageCount > 1 ? (
                <p className="font-mono text-sx-xs text-[var(--text-tertiary)]">
                  Page {addonPageSafe + 1} of {addonPageCount}
                </p>
              ) : null}
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                    priceSuffix={projectAddonPriceSuffix(
                      addon,
                      effectiveAddonCycle,
                    )}
                    caption={extraEditAddonCaption(
                      addon,
                      plans,
                      project.planId,
                    )}
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
                        ? "Starting…"
                        : hasValidPlan
                          ? "Purchase add-on"
                          : "Subscribe to enable"
                    }
                    onPress={() => {
                      if (!hasValidPlan) {
                        navigate(`/projects/${project.id}/plan`);
                        return;
                      }
                      const checkoutReturnUrl = `${window.location.origin}/projects/${project.id}/add-ons/checkout`;
                      const cart = buildAddonCheckoutCartFromAddons({
                        project,
                        addons: [addon],
                        plans,
                        returnUrl: checkoutReturnUrl,
                      });
                      saveAddonCheckoutCart({
                        ...cart,
                        ...(canChooseAddonCycle
                          ? { addonRecurringCycle: effectiveAddonCycle }
                          : {}),
                      });
                      navigate(`/projects/${project.id}/add-ons/checkout`);
                    }}
                  />
                );
              })}
            </div>

            {addonPageCount > 1 ? (
              <div className="mt-5 flex items-center justify-center gap-2">
                <SxButton
                  variant="secondary"
                  size="sm"
                  disabled={addonPageSafe <= 0}
                  onClick={() => setAddonPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </SxButton>
                <SxButton
                  variant="secondary"
                  size="sm"
                  disabled={addonPageSafe >= addonPageCount - 1}
                  onClick={() =>
                    setAddonPage((p) => Math.min(addonPageCount - 1, p + 1))
                  }
                >
                  Next
                </SxButton>
              </div>
            ) : null}
          </div>
        ) : null}

        {!canBuyExtraEdits &&
        existingCards.length === 0 &&
        availableAddons.length === 0 &&
        hasValidPlan ? (
          <p className="text-sx-sm text-[var(--text-secondary)]">
            No add-ons are available for your plan and billing cycle.
          </p>
        ) : null}
      </SxPanel>

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
        onNotice={(msg) => msg && toast.error(msg)}
        baseReturnUrl={`${window.location.origin}/projects/${project.id}`}
      />
    </div>
  );
}
