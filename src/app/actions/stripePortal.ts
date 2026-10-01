"use server";

import Stripe from "stripe";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface PortalActionResult {
  error?: string;
}

/**
 * Creates an ephemeral Stripe Customer Portal session for self-serve plan
 * changes, invoice downloads, and payment method updates — no founder
 * intervention required.
 */
export async function createCustomerPortalSession(): Promise<PortalActionResult | never> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const supabase = await createClient();

  // 1. Authenticate the active user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "Authentication required to access billing management." };
  }

  // 2. Fetch the organization profile and Stripe Customer ID
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("org_id, organizations(id, name, stripe_customer_id, billing_status)")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organizations) {
    return { error: "Organization record could not be found." };
  }

  const org = profile.organizations as unknown as {
    id: string;
    name: string;
    stripe_customer_id: string | null;
    billing_status: string;
  };

  // 3. Ensure organization has an active Stripe customer reference
  if (!org.stripe_customer_id) {
    return {
      error: "No active payment profile found. Please select a subscription plan first.",
    };
  }

  // 4. Create the Stripe Customer Portal session and redirect
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing`,
    });
    redirect(portalSession.url);
  } catch (err: unknown) {
    // NEXT_REDIRECT errors are control flow, not failures — rethrow
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: string }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    const errorDetails = err instanceof Error ? err.message : "Portal initialization error";
    return { error: `Stripe billing service error: ${errorDetails}` };
  }
}
