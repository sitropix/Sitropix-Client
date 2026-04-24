import { prisma } from "../db/client.mjs";
import {
  FEATURE_SUBSCRIPTION_PAUSE_RESUME,
  FEATURE_SUBSCRIPTION_SELF_CANCEL,
  SUBSCRIPTION_FEATURE_KEYS,
} from "../constants/featureFlagKeys.mjs";

const DEFAULT_FLAGS = [
  {
    key: FEATURE_SUBSCRIPTION_PAUSE_RESUME,
    label: "Client: pause / resume subscription",
    enabled: true,
  },
  {
    key: FEATURE_SUBSCRIPTION_SELF_CANCEL,
    label: "Client: self-service cancel subscription",
    enabled: true,
  },
];

export async function ensureFeatureFlagDefaults() {
  for (const row of DEFAULT_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: row.key },
      create: row,
      update: { label: row.label },
    });
  }
}

/**
 * Effective flags for subscription UI + API enforcement.
 * Plan-specific override wins when present; otherwise global default.
 */
export async function resolveSubscriptionFeatureControls(planId) {
  const globals = await prisma.featureFlag.findMany({
    where: { key: { in: [...SUBSCRIPTION_FEATURE_KEYS] } },
  });
  const g = Object.fromEntries(globals.map((f) => [f.key, f.enabled]));

  let overrides = [];
  if (planId) {
    overrides = await prisma.planFeatureOverride.findMany({
      where: { planId, key: { in: [...SUBSCRIPTION_FEATURE_KEYS] } },
    });
  }
  const o = Object.fromEntries(overrides.map((x) => [x.key, x.enabled]));

  const pick = (key) => (key in o ? o[key] : (g[key] ?? true));

  return {
    pauseResume: pick(FEATURE_SUBSCRIPTION_PAUSE_RESUME),
    selfCancel: pick(FEATURE_SUBSCRIPTION_SELF_CANCEL),
  };
}

export async function listFeatureFlagsForAdmin() {
  await ensureFeatureFlagDefaults();
  const [flags, overrides] = await Promise.all([
    prisma.featureFlag.findMany({ orderBy: { key: "asc" } }),
    prisma.planFeatureOverride.findMany({
      include: { plan: { select: { id: true, name: true, code: true } } },
      orderBy: [{ planId: "asc" }, { key: "asc" }],
    }),
  ]);
  return { flags, overrides };
}
