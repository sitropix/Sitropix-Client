import { useEffect, useState } from "react";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import {
  fetchAdminSystemConfig,
  testAdminSystemConfigDb,
  testAdminSystemConfigStripe,
} from "@/services/subscriptionsApi";
import type { SystemConfigItem, SystemConfigPayload } from "@/types/subscription";
import { SxBadge } from "@/components/sx/Badge";
import { SxButton } from "@/components/sx/Button";
import { SxPanel } from "@/components/sx/Panel";
import { useSxToast } from "@/components/sx/Toast";

type TestState = "idle" | "testing" | "ok" | "fail";

export function EnvironmentConfigPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const toast = useSxToast();
  const [payload, setPayload] = useState<SystemConfigPayload | null>(
    cache.systemConfig ?? null,
  );
  const [loading, setLoading] = useState(!cache.systemConfig);
  const [dbState, setDbState] = useState<TestState>("idle");
  const [stripeState, setStripeState] = useState<TestState>("idle");

  useEffect(() => {
    let cancelled = false;
    void fetchAdminSystemConfig()
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        updateCache({ systemConfig: data });
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load environment config.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runDbTest() {
    setDbState("testing");
    try {
      await testAdminSystemConfigDb();
      setDbState("ok");
      toast.success("Database reachable.");
    } catch (err) {
      setDbState("fail");
      toast.error(
        "Database test failed.",
        err instanceof Error ? err.message : undefined,
      );
    }
  }

  async function runStripeTest() {
    setStripeState("testing");
    try {
      await testAdminSystemConfigStripe();
      setStripeState("ok");
      toast.success("Stripe key valid.");
    } catch (err) {
      setStripeState("fail");
      toast.error(
        "Stripe test failed.",
        err instanceof Error ? err.message : undefined,
      );
    }
  }

  function statusBadge(state: TestState) {
    if (state === "ok") return <SxBadge variant="success">Reachable</SxBadge>;
    if (state === "fail") return <SxBadge variant="danger">Failed</SxBadge>;
    if (state === "testing")
      return <SxBadge variant="info">Testing…</SxBadge>;
    return null;
  }

  function renderItem(item: SystemConfigItem) {
    const masked = item.isSecret ? item.secretMask ?? "•••• not set" : item.value;
    const isDb = item.key === "DATABASE_URL";
    const isStripe = item.key === "STRIPE_SECRET_KEY";
    const testState = isDb ? dbState : isStripe ? stripeState : "idle";
    return (
      <li
        key={item.key}
        className="flex flex-col gap-3 rounded-sx-md border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sx-sm font-semibold text-[var(--text-primary)]">
              {item.key}
            </p>
            <SxBadge
              variant={item.configuredInDatabase ? "info" : "neutral"}
              withDot={false}
            >
              {item.configuredInDatabase ? "DB-managed" : "from env"}
            </SxBadge>
            {statusBadge(testState)}
          </div>
          <p className="mt-1 truncate font-mono text-sx-xs text-[var(--text-tertiary)]">
            {masked}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {isDb ? (
            <SxButton
              variant="secondary"
              size="sm"
              loading={dbState === "testing"}
              onClick={() => void runDbTest()}
            >
              Test connection
            </SxButton>
          ) : null}
          {isStripe ? (
            <SxButton
              variant="secondary"
              size="sm"
              loading={stripeState === "testing"}
              onClick={() => void runStripeTest()}
            >
              Test Stripe
            </SxButton>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-[var(--border-subtle)] pb-4">
        <p className="font-mono text-sx-2xs uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          Settings
        </p>
        <h1 className="mt-1.5 font-ui text-sx-xl font-semibold text-[var(--text-primary)]">
          Environment
        </h1>
        <p className="mt-1 text-sx-sm text-[var(--text-secondary)]">
          Read-only view of system integrations. Edit values in the server's
          environment file or DB config — this page only verifies connectivity.
        </p>
      </header>

      <SxPanel padded={false} bodyClassName="p-4">
        {loading ? (
          <p className="text-sx-sm text-[var(--text-tertiary)]">Loading…</p>
        ) : !payload || payload.items.length === 0 ? (
          <p className="text-sx-sm text-[var(--text-tertiary)]">
            No system config items reported.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {payload.items.map((item) => renderItem(item))}
          </ul>
        )}
      </SxPanel>
    </div>
  );
}
