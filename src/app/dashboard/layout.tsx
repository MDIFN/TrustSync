import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, LayoutDashboard, Database, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, organizations(name)")
    .eq("id", user.id)
    .single();
  const orgName =
    (profile?.organizations as unknown as { name: string } | null)?.name ?? "Your Workspace";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              TrustSync
              <span className="text-indigo-400">.ai</span>
            </span>
            <span className="ml-3 hidden rounded-full border border-slate-800 px-2.5 py-0.5 text-[10px] text-slate-400 md:inline">
              {orgName}
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-xs">
            <DashboardNavItem href="/dashboard" icon={<LayoutDashboard className="h-3.5 w-3.5" />}>
              Overview
            </DashboardNavItem>
            <DashboardNavItem href="/dashboard/documents" icon={<Database className="h-3.5 w-3.5" />}>
              Knowledge Base
            </DashboardNavItem>
            <DashboardNavItem href="/dashboard/billing" icon={<CreditCard className="h-3.5 w-3.5" />}>
              Billing
            </DashboardNavItem>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

function DashboardNavItem({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium text-slate-400 transition hover:bg-slate-900 hover:text-slate-100"
    >
      {icon}
      {children}
    </Link>
  );
}

function SignOutButton() {
  return (
    <form action="/api/auth/signout" method="post">
      <button
        type="submit"
        className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-2 font-medium text-slate-400 transition hover:border-slate-700 hover:text-slate-100"
      >
        Sign Out
      </button>
    </form>
  );
}
