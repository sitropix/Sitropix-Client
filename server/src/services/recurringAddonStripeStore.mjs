import { prisma } from "../db/client.mjs";

const USER_MESSAGE =
  "Billing storage is not ready on this server. Ask your admin to run: npm run prisma:generate && npm run db:deploy, then restart the API.";

/** Prisma delegate for `ProjectRecurringAddonStripe` (missing if client was not regenerated). */
export function recurringAddonStripeDelegate() {
  const d = prisma.projectRecurringAddonStripe;
  if (d && typeof d.findUnique === "function") return d;
  return null;
}

export function assertRecurringAddonStripeStoreReady() {
  const delegate = recurringAddonStripeDelegate();
  if (!delegate) {
    return { ok: false, message: "recurring_addon_prisma_not_ready", userMessage: USER_MESSAGE };
  }
  return { ok: true, delegate };
}

export async function findRecurringAddonStripeRow(projectId, addonCode) {
  const ready = assertRecurringAddonStripeStoreReady();
  if (!ready.ok) return { ready, row: null };
  const row = await ready.delegate.findUnique({
    where: { projectId_addonCode: { projectId, addonCode } },
  });
  return { ready, row };
}

export async function upsertRecurringAddonStripeRow({
  projectId,
  addonCode,
  stripeSubscriptionId,
  billingCycle,
}) {
  const ready = assertRecurringAddonStripeStoreReady();
  if (!ready.ok) return ready;
  try {
    await ready.delegate.upsert({
      where: { projectId_addonCode: { projectId, addonCode } },
      create: {
        projectId,
        addonCode,
        stripeSubscriptionId,
        billingCycle,
      },
      update: {
        stripeSubscriptionId,
        billingCycle,
      },
    });
    return { ok: true };
  } catch (e) {
    const code = e?.code ?? "";
    if (code === "P2021" || String(e?.message ?? "").includes("does not exist")) {
      return {
        ok: false,
        message: "recurring_addon_table_missing",
        userMessage: `${USER_MESSAGE} (database migration pending)`,
      };
    }
    throw e;
  }
}

export async function findRecurringAddonStripeByStripeSubscriptionId(stripeSubscriptionId) {
  const ready = assertRecurringAddonStripeStoreReady();
  if (!ready.ok) return { ready, row: null };
  const row = await ready.delegate.findFirst({
    where: { stripeSubscriptionId },
  });
  return { ready, row };
}

export async function deleteRecurringAddonStripeRow(id) {
  const ready = assertRecurringAddonStripeStoreReady();
  if (!ready.ok) return ready;
  await ready.delegate.delete({ where: { id } });
  return { ok: true };
}

export function attachFailureResponse(attachRes) {
  const userMessage =
    attachRes.userMessage ??
    (attachRes.message === "recurring_addon_prisma_not_ready" ||
    attachRes.message === "recurring_addon_table_missing"
      ? USER_MESSAGE
      : attachRes.message ?? "Could not attach recurring add-on to your subscription.");
  return {
    error: "stripe_subscription_item_failed",
    message: userMessage,
    code: attachRes.message,
  };
}
