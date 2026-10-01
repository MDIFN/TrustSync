import { createClient } from "@supabase/supabase-js";

/**
 * Administrative Supabase client using the service-role key.
 * BYPASSES Row-Level Security — server-only, never import from client code.
 * Used by: Stripe webhooks, Inngest background workers, public lead capture.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
