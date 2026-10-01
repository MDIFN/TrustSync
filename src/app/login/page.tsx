"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, Loader2, MailCheck, ArrowRight } from "lucide-react";
import { loginWithMagicLink } from "@/app/actions/login";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await loginWithMagicLink(email, companyName);
      if (result.success) {
        setSent(true);
      } else {
        setError(result.error || "Something went wrong.");
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Sign in to TrustSync
          </h1>
          <p className="text-center text-xs text-slate-400">
            Passwordless magic-link authentication. New emails get a workspace
            created automatically.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur">
          {sent ? (
            <div className="text-center">
              <MailCheck className="mx-auto h-10 w-10 text-emerald-400" />
              <h2 className="mt-3 text-base font-semibold text-white">
                Check your inbox
              </h2>
              <p className="mt-2 text-xs text-slate-400">
                We sent a sign-in link to <span className="text-slate-200">{email}</span>.
                Click it to enter your dashboard.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="companyName" className="block text-xs font-medium text-slate-300">
                  Company Name <span className="text-slate-500">(new accounts only)</span>
                </label>
                <input
                  id="companyName"
                  type="text"
                  placeholder="Acme Inc."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-slate-300">
                  Work Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              {error && (
                <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-3 text-xs text-rose-300">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending link...
                  </>
                ) : (
                  <>
                    Continue with Magic Link <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
