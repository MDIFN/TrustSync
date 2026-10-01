"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface AuthResult {
  success: boolean;
  error?: string;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || `org-${Date.now().toString(36)}`
  );
}

/**
 * Magic-link login/signup. On first signup, bootstraps an organization and
 * profile row so RLS has a tenant boundary immediately.
 */
export async function loginWithMagicLink(
  email: string,
  companyName: string,
): Promise<AuthResult> {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { success: false, error: "Enter a valid email address." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Bootstrap org + profile when this is a brand-new user.
  // signInWithOtp returns the user only when the session exists (existing
  // user already logged in); new signups complete after the email link, so
  // provisioning also runs in the auth callback fallback.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await ensureOrgAndProfile(user.id, email, companyName);
  }

  return { success: Boolean(data) || Boolean(user) };
}

/** Idempotent org + profile bootstrap. Server-side helper. */
export async function ensureOrgAndProfile(
  userId: string,
  email: string,
  companyName: string,
): Promise<void> {
  const supabaseAdmin = createAdminClient();

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, org_id")
    .eq("id", userId)
    .maybeSingle();

  if (existing) return;

  const slug = `${slugify(companyName)}-${Date.now().toString(36)}`;
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .insert({ name: companyName || email.split("@")[1], slug })
    .select("id")
    .single();

  if (!org) return;

  await supabaseAdmin.from("profiles").insert({
    id: userId,
    org_id: org.id,
    full_name: null,
    role: "owner",
  });
}
