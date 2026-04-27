import { useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useAdminPrefetch } from "@/context/AdminPrefetchContext";
import {
  fetchAdminSystemConfig,
  saveAdminSystemConfig,
  testAdminSystemConfigDb,
  testAdminSystemConfigStripe,
} from "@/services/subscriptionsApi";
import { ApiRequestError, isModuleForbiddenError } from "@/services/http";
import { NoModuleAccess } from "@/components/NoModuleAccess";
import type { SystemConfigItem } from "@/types/subscription";

export function EnvironmentConfigPage() {
  const { cache, updateCache } = useAdminPrefetch();
  const [items, setItems] = useState<SystemConfigItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noModuleAccess, setNoModuleAccess] = useState(false);

  async function load() {
    setLoading(items.length === 0);
    setNoModuleAccess(false);
    try {
      const data = await fetchAdminSystemConfig();
      setItems(data.items);
      updateCache({ systemConfig: data });
    } catch (err) {
      if (isModuleForbiddenError(err)) {
        setNoModuleAccess(true);
        return;
      }
      setNotice("Could not load environment configuration.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cache.systemConfig) {
      setItems(cache.systemConfig.items);
      setLoading(false);
      return;
    }
    void load();
  }, []);

  const grouped = useMemo(() => {
    const infra = items.filter((i) => ["DATABASE_URL", "APP_URL", "API_URL", "ALLOWED_REDIRECT_ORIGINS"].includes(i.key));
    const stripe = items.filter((i) =>
      ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL"].includes(i.key),
    );
    const email = items.filter((i) => ["EMAIL_PROVIDER", "EMAIL_FROM", "RESEND_API_KEY", "SENDGRID_API_KEY"].includes(i.key));
    return { infra, stripe, email };
  }, [items]);

  if (noModuleAccess) {
    return <NoModuleAccess moduleLabel="Environment Configuration" />;
  }

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Admin" }, { label: "Environment config" }]} />
      <header>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Environment configuration</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Master admin only. Update secure runtime settings without direct server file access. Secret fields are masked and encrypted at rest.
        </p>
      </header>

      {notice && <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/90">{notice}</p>}
      {loading && <p className="text-sm text-ink-muted">Loading…</p>}

      {!loading &&
        ([
          { title: "Infrastructure", rows: grouped.infra },
          { title: "Stripe", rows: grouped.stripe },
          { title: "Email", rows: grouped.email },
        ] as const).map((group) => (
          <section key={group.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-sm font-semibold text-white">{group.title}</h2>
            <div className="mt-4 space-y-3">
              {group.rows.map((row) => (
                <div key={row.key} className="grid gap-2 md:grid-cols-[220px_1fr] md:items-center">
                  <label className="text-xs font-semibold tracking-wide text-ink-subtle">{row.key}</label>
                  <input
                    type={row.isSecret ? "password" : "text"}
                    value={row.value}
                    placeholder={row.isSecret ? row.secretMask ?? "Set secret value" : ""}
                    onChange={(e) =>
                      setItems((prev) => prev.map((x) => (x.key === row.key ? { ...x, value: e.target.value } : x)))
                    }
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-lime/35"
                  />
                </div>
              ))}
            </div>
          </section>
        ))}

      {!loading && (
        <section className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void (async () => {
                setSaving(true);
                setNotice(null);
                try {
                  await saveAdminSystemConfig(items.map((x) => ({ key: x.key, value: x.value, isSecret: x.isSecret })));
                  setNotice("Environment config saved.");
                  await load();
                } catch (err) {
                  if (err instanceof ApiRequestError) setNotice(err.message || "Save failed.");
                  else setNotice("Save failed.");
                } finally {
                  setSaving(false);
                }
              })()
            }
            className="rounded-full bg-brand-lime px-6 py-2.5 text-sm font-semibold text-canvas transition hover:bg-brand-lime-dim disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save configuration"}
          </button>
          <button
            type="button"
            onClick={() =>
              void testAdminSystemConfigDb()
                .then(() => setNotice("Database test successful."))
                .catch(() => setNotice("Database test failed."))
            }
            className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-white transition hover:border-brand-lime/35"
          >
            Test DB
          </button>
          <button
            type="button"
            onClick={() =>
              void testAdminSystemConfigStripe()
                .then(() => setNotice("Stripe test successful."))
                .catch(() => setNotice("Stripe test failed."))
            }
            className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-white transition hover:border-brand-lime/35"
          >
            Test Stripe
          </button>
        </section>
      )}
    </div>
  );
}

