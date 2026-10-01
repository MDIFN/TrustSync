"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for browser contexts (Client Components).
 * Used primarily for Realtime WebSocket subscriptions.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
