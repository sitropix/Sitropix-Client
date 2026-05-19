import { portal } from "@/components/portal/portalStyles";
import {
  CORE_REQUIRED_PROJECT_ASSETS,
  PROJECT_ASSET_TYPES,
  hasValidProjectPlan,
} from "@/services/projectsStore";
import {
  fetchProjectAssets,
  uploadProjectAssetFile,
  type ProjectAssetUploadRow,
} from "@/services/subscriptionsApi";
import type { ProjectRecord, ProjectRequirementType } from "@/types/project";
import { PortalOverlay } from "@/components/ui/PortalOverlay";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

type Props = {
  project: ProjectRecord | null;
  open: boolean;
  onClose: () => void;
  /** When provided, skips internal fetch and uses parent asset list. */
  assets?: ProjectAssetUploadRow[];
  assetsLoading?: boolean;
  onAssetsUpdated?: () => void | Promise<void>;
};

export function ProjectSetupDialog({
  project,
  open,
  onClose,
  assets: controlledAssets,
  assetsLoading: assetsLoadingProp,
  onAssetsUpdated,
}: Props) {
  const [internalAssets, setInternalAssets] = useState<ProjectAssetUploadRow[]>([]);
  const [internalAssetsLoading, setInternalAssetsLoading] = useState(false);
  const assetsLoading = assetsLoadingProp ?? internalAssetsLoading;
  const [notice, setNotice] = useState<string | null>(null);
  const [quickUploadType, setQuickUploadType] =
    useState<ProjectRequirementType>("requirements");
  const [uploadingType, setUploadingType] = useState<ProjectRequirementType | null>(null);
  const quickUploadRef = useRef<HTMLInputElement | null>(null);

  const serverAssets = controlledAssets ?? internalAssets;
  const managesOwnAssets = controlledAssets === undefined;

  useEffect(() => {
    if (!open || !project?.id || !managesOwnAssets) return;
    let cancelled = false;
    setInternalAssetsLoading(true);
    void fetchProjectAssets(project.id, { force: true })
      .then((rows) => {
        if (!cancelled) setInternalAssets(rows);
      })
      .catch(() => {
        if (!cancelled) setInternalAssets([]);
      })
      .finally(() => {
        if (!cancelled) setInternalAssetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, project?.id, managesOwnAssets]);

  useEffect(() => {
    if (!open) setNotice(null);
  }, [open]);

  if (!open || !project) return null;

  const coreRequired = CORE_REQUIRED_PROJECT_ASSETS;
  const completedCoreCount = coreRequired.filter((req) =>
    serverAssets.some((asset) => asset.type === req.type),
  ).length;
  const assetsReady = !assetsLoading;
  const needsOnboarding = assetsReady && completedCoreCount < coreRequired.length;
  const allRequirementsDone = assetsReady && !needsOnboarding;
  const hasValidPlan = hasValidProjectPlan(project);

  async function afterAssetChange() {
    if (managesOwnAssets && project) {
      try {
        const rows = await fetchProjectAssets(project.id, { force: true });
        setInternalAssets(rows);
      } catch {
        setInternalAssets([]);
      }
    }
    await onAssetsUpdated?.();
  }

  return (
    <PortalOverlay open={open} onClose={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-labelledby="project-setup-dialog-title"
        className="flex max-h-[min(92dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-on-surface/10 bg-surface-container-lowest text-on-surface shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-on-surface/10 px-5 pb-3 pt-5">
          <div>
            <span className="inline-flex rounded-full bg-gold-light px-2 py-0.5 font-caption text-[10px] font-semibold uppercase tracking-wider text-on-secondary-container">
              Draft project
            </span>
            <h2
              id="project-setup-dialog-title"
              className="mt-2 font-h3 text-h3 font-bold text-on-surface"
            >
              {project.name}
            </h2>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              {allRequirementsDone
                ? "All required uploads are complete. Continue to subscription to activate this project."
                : "Upload the required items below. Additional materials help us deliver faster but are optional."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-on-surface/15 text-on-surface-variant transition hover:bg-surface-container-low"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="flex items-center justify-between font-body-sm text-body-sm">
            <span className="font-semibold text-on-surface">Required progress</span>
            <span className="text-on-surface-variant">
              {assetsLoading ? "…" : `${completedCoreCount}/${coreRequired.length}`}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container">
            <div
              className="h-full bg-accent-gold transition-[width]"
              style={{
                width: assetsLoading
                  ? "0%"
                  : `${(completedCoreCount / Math.max(1, coreRequired.length)) * 100}%`,
              }}
            />
          </div>

          <ul className="mt-4 space-y-2">
            {PROJECT_ASSET_TYPES.map((req) => {
              const done = serverAssets.some((asset) => asset.type === req.type);
              const isCore = coreRequired.some((c) => c.type === req.type);
              return (
                <li
                  key={req.type}
                  className="flex items-center justify-between gap-2 rounded-xl border border-on-surface/10 bg-surface-container-lowest px-3 py-2.5"
                >
                  <span className="min-w-0 font-body-sm text-body-sm text-on-surface">
                    {req.label}
                    {!isCore ? (
                      <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-on-surface-variant">
                        Optional
                      </span>
                    ) : (
                      <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-amber-800/90">
                        Required
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {done ? (
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                        Done
                      </span>
                    ) : null}
                    <button
                      type="button"
                      disabled={uploadingType !== null || assetsLoading}
                      onClick={() => {
                        if (uploadingType !== null || assetsLoading) return;
                        setQuickUploadType(req.type);
                        quickUploadRef.current?.click();
                      }}
                      className={
                        (done ? portal.btnSecondary : portal.btnDark) +
                        " !px-3 !py-1 !text-xs disabled:opacity-40"
                      }
                    >
                      {uploadingType === req.type
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
            disabled={uploadingType !== null}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || uploadingType !== null || !project) return;
              setUploadingType(quickUploadType);
              setNotice(null);
              try {
                await uploadProjectAssetFile(project.id, quickUploadType, file);
                await afterAssetChange();
              } catch (err) {
                setNotice(
                  err instanceof Error ? err.message : "Could not upload asset.",
                );
                e.currentTarget.value = "";
                return;
              } finally {
                setUploadingType(null);
              }
              e.currentTarget.value = "";
            }}
          />

          {notice ? (
            <p className="mt-3 font-body-sm text-body-sm text-amber-800">{notice}</p>
          ) : null}

          {hasValidPlan ? (
            <p className="mt-4 font-body-sm text-body-sm text-emerald-800">
              This project already has an active subscription.
            </p>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 border-t border-on-surface/10 bg-surface-container-lowest px-5 py-4">
          <Link
            to={`/projects/${project.id}/subscription`}
            className={
              portal.btnPrimary +
              ` w-full !py-3 !text-sm ${
                needsOnboarding || uploadingType !== null || assetsLoading || hasValidPlan
                  ? "pointer-events-none opacity-40"
                  : ""
              }`
            }
            onClick={(e) => {
              if (needsOnboarding || uploadingType !== null || assetsLoading || hasValidPlan) {
                e.preventDefault();
              }
            }}
          >
            Continue to Subscription
          </Link>
          <Link
            to={`/projects/${project.id}`}
            className={portal.btnSecondary + " w-full !py-2.5 !text-sm"}
            onClick={onClose}
          >
            Open full dashboard
          </Link>
          <p className="text-center font-caption text-[11px] text-on-surface-variant">
            A valid subscription is required to activate the project.
          </p>
        </div>
      </div>
    </PortalOverlay>
  );
}
