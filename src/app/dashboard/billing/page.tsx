import { CheckCircle2, CreditCard, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  createCheckoutSession,
} from "@/app/actions/stripeCheckout";
import {
  createCustomerPortalSession,
} from "@/app/actions/stripePortal";
import { PRICING_TIERS } from "@/lib/pricing";

export const dynamic = "force-dynamic";

function priceIdFor(envKey: string): string | null {
  return process.env[envKey] ?? null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { billing } = await searchParams;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("organizations(billing_status, stripe_customer_id, current_period_end, stripe_price_id)")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .single();

  const org = (profile?.organizations ?? null) as unknown as
    | {
        billing_status: string;
        stripe_customer_id: string | null;
        current_period_end: string | null;
        stripe_price_id: string | null;
      }
    | null;

  const hasSubscription = Boolean(org?.stripe_customer_id);
  const currentTier = PRICING_TIERS.find((t) => priceIdFor(t.priceEnv) === org?.stripe_price_id);

  async function checkout(priceEnv: string) {
    "use server";
    const priceId = priceIdFor(priceEnv);
    if (!priceId) throw new Error(`Price ID not configured (${priceEnv}).`);
    await createCheckoutSession(priceId);
  }

  async function openPortal() {
    "use server";
    await createCustomerPortalSession();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Subscription & Billing</h1>
        <p className="mt-1 text-xs text-slate-400">
          Manage your plan, invoices, and payment methods via the self-serve portal.
        </p>
      </div>

      {billing === "success" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Payment received. Your subscription activates within seconds.
        </div>
      )}

      {hasSubscription && org && (
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-100">
                {currentTier ? `${currentTier.name} Plan` : "Active Subscription"}
              </h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${
                  org.billing_status === "active"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-rose-500/10 text-rose-400"
                }`}
              >
                {org.billing_status}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {org.current_period_end
                ? `Renews ${new Date(org.current_period_end).toLocaleDateString()}`
                : "Billing period active"}
            </p>
          </div>
          <form action={openPortal}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              <CreditCard className="h-4 w-4 text-indigo-400" />
              Manage Subscription & Invoices
              <ExternalLink className="h-3 w-3 opacity-70" />
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {PRICING_TIERS.map((tier) => {
          const configured = Boolean(priceIdFor(tier.priceEnv));
          const isCurrent = currentTier?.id === tier.id;
          return (
            <div
              key={tier.id}
              className={`rounded-xl border p-6 ${
                "featured" in tier && tier.featured
                  ? "border-indigo-500 bg-slate-900/90"
                  : "border-slate-800 bg-slate-900/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">{tier.name}</h3>
                {isCurrent && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    Current
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-white">
                  ${tier.price.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>
              <ul className="mt-5 space-y-2 text-xs text-slate-300">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-indigo-400" /> {f}
                  </li>
                ))}
              </ul>
              {!isCurrent && (
                <form action={checkout.bind(null, tier.priceEnv)} className="mt-6">
                  <button
                    type="submit"
                    disabled={!configured}
                    title={configured ? undefined : `Set ${tier.priceEnv} to enable`}
                    className="w-full rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {configured ? `Subscribe to ${tier.name}` : "Unavailable (not configured)"}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
