import { useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { portal } from "@/components/portal/portalStyles";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { InvoiceTable } from "@/components/subscription/InvoiceTable";
import { useSubscriptionPortal } from "@/hooks/useSubscriptionPortal";
import { createBillingPortalSession } from "@/services/subscriptionsApi";

export function BillingPage() {
  const { data, loading, error } = useSubscriptionPortal();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function openBillingPortal() {
    setBusy(true);
    setNotice(null);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info("[subscription-flow]", "frontend.billing_portal.open.start", { from: "billing_page" });
    }
    try {
      const { url } = await createBillingPortalSession(`${window.location.origin}/billing`);
      if (url) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.info("[subscription-flow]", "frontend.billing_portal.open.redirect", { from: "billing_page" });
        }
        window.location.assign(url);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error("[subscription-flow]", "frontend.billing_portal.open.failed", {
          from: "billing_page",
          error: err instanceof Error ? err.message : String(err),
        });
      }
      setNotice("Billing portal needs a Stripe customer. Complete Checkout on the subscription page first, or use a dev trial.");
    } finally {
      setBusy(false);
    }
  }

  const defaultMethod = data?.paymentMethods.find((pm) => pm.isDefault);

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Billing" }]} />
      <header>
        <h1 className={portal.pageTitle}>Billing & Payments</h1>
        <p className={portal.pageSubtitle}>Manage your payment method and review invoice history.</p>
      </header>

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-body-sm text-body-sm text-rose-800">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-on-surface/10 bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
          {notice}
        </p>
      )}

      <section className={portal.panel}>
        <h2 className="font-body font-semibold text-on-surface">Payment method</h2>
        {loading ? (
          <Skeleton className="mt-3 h-10 w-64" />
        ) : defaultMethod ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="font-body-sm text-body-sm text-on-surface">
              {defaultMethod.brand.toUpperCase()} ending in {defaultMethod.last4}
              {defaultMethod.expMonth > 0 && defaultMethod.expYear > 0
                ? ` (exp ${defaultMethod.expMonth}/${defaultMethod.expYear})`
                : ""}
            </p>
            <button
              type="button"
              onClick={() => void openBillingPortal()}
              disabled={busy}
              className={portal.btnPrimary + " !text-sm"}
            >
              {busy ? "Opening…" : "Manage in Stripe portal"}
            </button>
          </div>
        ) : (
          <EmptyState
            title="No payment method"
            description="Add a payment method to avoid failed renewals."
            action={{ label: busy ? "Opening…" : "Add in Stripe", onClick: () => void openBillingPortal() }}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-body font-semibold text-on-surface">Invoices</h2>
        {loading ? (
          <Skeleton className="h-44 w-full rounded-2xl" />
        ) : data && data.invoices.length > 0 ? (
          <InvoiceTable invoices={data.invoices} />
        ) : (
          <EmptyState title="No invoices yet" description="Invoices will appear here after your first successful payment." />
        )}
      </section>
    </div>
  );
}
