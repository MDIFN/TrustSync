import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Lazy init: module-scope instantiation breaks `next build` page-data
// collection when STRIPE_SECRET_KEY is absent from the build environment.
function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

/**
 * Stripe webhook receiver: verifies signatures cryptographically, then
 * synchronizes subscription lifecycle into organizations via the service-role
 * client (webhooks run unauthenticated and must bypass RLS).
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook construction failed";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  const supabaseAdmin = createAdminClient();
  const stripe = getStripe();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        const orgId = session.metadata?.org_id || subscription.metadata?.org_id;
        const item = subscription.items.data[0];
        if (orgId) {
          await supabaseAdmin
            .from("organizations")
            .update({
              billing_status: "active",
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: subscription.id,
              stripe_price_id: item?.price.id || null,
              current_period_end: new Date(item.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
            })
            .eq("id", orgId);
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.org_id;
      const item = subscription.items.data[0];

      let mappedStatus: "active" | "past_due" | "canceled" = "active";
      if (subscription.status === "past_due") mappedStatus = "past_due";
      if (["canceled", "unpaid"].includes(subscription.status)) mappedStatus = "canceled";

      const updatePayload: Record<string, unknown> = {
        billing_status: mappedStatus,
        stripe_price_id: item?.price.id || null,
        current_period_end: new Date(item.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
      };

      if (orgId) {
        await supabaseAdmin
          .from("organizations")
          .update(updatePayload)
          .eq("id", orgId);
      } else {
        await supabaseAdmin
          .from("organizations")
          .update(updatePayload)
          .eq("stripe_subscription_id", subscription.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabaseAdmin
        .from("organizations")
        .update({
          billing_status: "canceled",
          stripe_price_id: null,
          cancel_at_period_end: false,
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.customer) {
        await supabaseAdmin
          .from("organizations")
          .update({ billing_status: "past_due" })
          .eq("stripe_customer_id", invoice.customer as string);
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
