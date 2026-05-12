import {
  CORE_REQUIRED_PROJECT_ASSETS,
  hasValidProjectPlan,
  listProjectsByUser,
} from "@/services/projectsStore";
import { fetchProjectAssets } from "@/services/subscriptionsApi";
import type { ProjectRecord } from "@/types/project";

export type OnboardingStatus = {
  hasProject: boolean;
  hasAssetsReady: boolean;
  hasActiveSubscription: boolean;
  completed: boolean;
};

export async function getOnboardingStatus(
  userId: string,
): Promise<OnboardingStatus> {
  const projects = await listProjectsByUser(userId);
  return getOnboardingStatusFromProjects(projects);
}

export async function getOnboardingStatusFromProjects(
  projects: ProjectRecord[],
): Promise<OnboardingStatus> {
  const hasProject = projects.length > 0;
  let hasAssetsReady = false;
  if (hasProject) {
    const assetsByProject = await Promise.all(
      projects.map(async (project) => {
        try {
          const rows = await fetchProjectAssets(project.id);
          return rows;
        } catch {
          return [];
        }
      }),
    );
    hasAssetsReady = assetsByProject.some((assets) =>
      CORE_REQUIRED_PROJECT_ASSETS.every((req) =>
        assets.some((asset) => asset.type === req.type),
      ),
    );
  }
  const hasActiveSubscription = projects.some((project) => hasValidProjectPlan(project));
  return {
    hasProject,
    hasAssetsReady,
    hasActiveSubscription,
    completed: hasProject && hasAssetsReady && hasActiveSubscription,
  };
}

export async function getProjectAssetReadiness(userId: string): Promise<Record<string, boolean>> {
  const projects = await listProjectsByUser(userId);
  return getProjectAssetReadinessForProjects(projects);
}

export async function getProjectAssetReadinessForProjects(projects: ProjectRecord[]): Promise<Record<string, boolean>> {
  const pairs = await Promise.all(
    projects.map(async (project) => {
      try {
        const assets = await fetchProjectAssets(project.id);
        const ready = CORE_REQUIRED_PROJECT_ASSETS.every((req) =>
          assets.some((asset) => asset.type === req.type),
        );
        return [project.id, ready] as const;
      } catch {
        return [project.id, false] as const;
      }
    }),
  );
  return Object.fromEntries(pairs);
}
