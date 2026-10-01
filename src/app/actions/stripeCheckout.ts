"use server";

import Stripe from "stripe";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

/**
 * Provisions a Stripe Hosted Checkout session for the caller's organization
 * and links org_id into customer + subscription metadata so webhooks can
 * synchronize billing state.
 */
export async function createCheckoutSession(priceId: string): Promise<void> {
  const stripe = getStripe();
  const supabase = await createClient();

  // 1. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("You must be logged in to subscribe.");
  }

  // 2. Fetch organization metadata
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, organizations(id, name, stripe_customer_id)")
    .eq("id", user.id)
    .single();

  const org = profile?.organizations as unknown as
    | { id: string; name: string; stripe_customer_id: string | null }
    | undefined;
  if (!org) {
    throw new Error("Organization profile not found.");
  }

  // 3. Create Stripe Customer if not already existing
  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: org.name,
      metadata: { org_id: org.id },
    });
    customerId = customer.id;
    await supabase
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", org.id);
  }

  // 4. Initialize Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { org_id: org.id },
    subscription_data: { metadata: { org_id: org.id } },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?billing=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing?billing=canceled`,
  });

  if (!session.url) {
    throw new Error("Failed to initialize checkout session.");
  }

  redirect(session.url);
}
