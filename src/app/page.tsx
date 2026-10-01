"use client";

import { useState, useTransition } from "react";
import {
  ShieldCheck,
  FileSpreadsheet,
  Zap,
  ArrowRight,
  CheckCircle2,
  Lock,
  Clock,
  Sparkles,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  submitWaitlistAction,
  type WaitlistSubmissionInput,
} from "@/app/actions/submitWaitlist";
import { PRICING_TIERS } from "@/lib/pricing";

const FRAMEWORKS = ["SOC 2 Type II", "ISO 27001", "HIPAA", "Privacy Policy"];
const BOTTLENECKS = [
  "Senior Engineers",
  "Sales Ops",
  "CISO / Security Team",
  "Founder / CEO",
];

export default function LandingPage() {
  const [formData, setFormData] = useState<WaitlistSubmissionInput>({
    workEmail: "",
    companyName: "",
    dealSizeTier: "25k_to_100k",
    currentBottleneck: "Senior Engineers",
    complianceFrameworks: ["SOC 2 Type II"],
  });
  const [isPending, startTransition] = useTransition();
  const [submissionStatus, setSubmissionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleFrameworkToggle = (framework: string) => {
    setFormData((prev) => {
      const exists = prev.complianceFrameworks.includes(framework);
      return {
        ...prev,
        complianceFrameworks: exists
          ? prev.complianceFrameworks.filter((f) => f !== framework)
          : [...prev.complianceFrameworks, framework],
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    startTransition(async () => {
      const res = await submitWaitlistAction(formData);
      if (res.success) {
        setSubmissionStatus("success");
      } else {
        setSubmissionStatus("error");
        setErrorMessage(res.error || "Failed to submit request.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-600/30">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              TrustSync
              <span className="text-indigo-400">.ai</span>
            </span>
          </div>
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-400 md:flex">
            <a href="#features" className="transition hover:text-slate-100">How It Works</a>
            <a href="#comparison" className="transition hover:text-slate-100">Comparison</a>
            <a href="#pricing" className="transition hover:text-slate-100">Pricing</a>
            <a href="#faq" className="transition hover:text-slate-100">FAQ</a>
          </div>
          <a
            href="#waitlist"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            Get Free Pilot
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-transparent to-transparent" />
        <div className="mx-auto max-w-5xl px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-medium text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            Now in Private Beta for High-Growth B2B SaaS
          </div>
          <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl">
            Turn 150-Question Security Spreadsheets into{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Done in 20 Minutes.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Stop burning high-cost engineering hours on repetitive SOC 2, SIG
            Lite, and CAIQ questionnaires. TrustSync reads your existing
            compliance collateral and auto-fills spreadsheets with verifiable
            citations.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#waitlist"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-8 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 sm:w-auto"
            >
              Upload Your Questionnaire — Free Pilot
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#features"
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-8 text-sm font-semibold text-slate-300 transition hover:border-slate-700 hover:text-white sm:w-auto"
            >
              See How It Works
            </a>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-indigo-400" /> Zero AI model training
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-400" /> 2-Hour turnaround SLA
            </span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="features" className="border-t border-slate-800/80 bg-slate-900/20 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Three-Step Pipeline
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              From Raw Spreadsheet to Verified Delivery
            </p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">
                1. Ingest Compliance Collateral
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Upload your SOC 2 audit reports, ISO 27001 manuals, penetration
                test summaries, and privacy policies into a tenant-isolated
                vector store.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-600/10 text-cyan-400">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">
                2. Deterministic RAG Auto-Fill
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Hybrid lexical and vector search retrieves exact policy clauses.
                Claude drafts precise answers tagged with document citations and
                confidence scores.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-400">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">
                3. Non-Destructive Export
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Export directly back into the customer&apos;s original .xlsx
                workbook. Custom dropdowns, cell formulas, and formatting stay
                100% intact.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="comparison" className="border-t border-slate-800/80 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Competitive Edge
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Why B2B Teams Choose TrustSync
            </p>
          </div>
          <div className="mt-12 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-xs text-slate-400">
                <tr>
                  <th className="py-4 pl-6 pr-4">Feature / Metric</th>
                  <th className="px-4 py-4">Manual Engineering</th>
                  <th className="px-4 py-4">Legacy RFP Platforms</th>
                  <th className="py-4 pl-4 pr-6 text-indigo-400">TrustSync AI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                <tr>
                  <td className="py-4 pl-6 pr-4 font-semibold text-slate-300">Annual Software Cost</td>
                  <td className="px-4 py-4 text-slate-400">$0 (SaaS) / $15k+ (lost eng. time)</td>
                  <td className="px-4 py-4 text-slate-400">$25,000 to $50,000 / year</td>
                  <td className="py-4 pl-4 pr-6 font-semibold text-emerald-400">$499 to $999 / month</td>
                </tr>
                <tr>
                  <td className="py-4 pl-6 pr-4 font-semibold text-slate-300">Time to Implement</td>
                  <td className="px-4 py-4 text-slate-400">Instant (ongoing repetitive drain)</td>
                  <td className="px-4 py-4 text-slate-400">6 to 12 weeks of tagging</td>
                  <td className="py-4 pl-4 pr-6 font-semibold text-indigo-400">&lt; 15 minutes self-serve</td>
                </tr>
                <tr>
                  <td className="py-4 pl-6 pr-4 font-semibold text-slate-300">Formatting Integrity</td>
                  <td className="px-4 py-4 text-slate-400">Prone to formula/cell destruction</td>
                  <td className="px-4 py-4 text-slate-400">Forces proprietary web portals</td>
                  <td className="py-4 pl-4 pr-6 font-semibold text-emerald-400">100% preserved .xlsx binary</td>
                </tr>
                <tr>
                  <td className="py-4 pl-6 pr-4 font-semibold text-slate-300">Citation Transparency</td>
                  <td className="px-4 py-4 text-slate-400">Unverifiable tribal memory</td>
                  <td className="px-4 py-4 text-slate-400">Manual static answer tags</td>
                  <td className="py-4 pl-4 pr-6 font-semibold text-indigo-400">Exact clickable source snippets</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-slate-800/80 bg-slate-900/20 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Predictable Subscriptions
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Plans That Scale With Your Pipeline
            </p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={
                  "featured" in tier && tier.featured
                    ? "relative rounded-xl border-2 border-indigo-500 bg-slate-900/90 p-8 shadow-2xl shadow-indigo-500/10 backdrop-blur"
                    : "rounded-xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur"
                }
              >
                {"featured" in tier && tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold text-white">{tier.name} Plan</h3>
                <p className="mt-1 text-xs text-slate-400">{tier.description}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">
                    ${tier.price.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>
                <ul className="mt-8 space-y-3 text-xs text-slate-300">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href="#waitlist"
                  className={
                    "featured" in tier && tier.featured
                      ? "mt-8 block w-full rounded-lg bg-indigo-600 py-2.5 text-center text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
                      : "mt-8 block w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-center text-xs font-semibold text-white transition hover:bg-slate-700"
                  }
                >
                  {tier.id === "enterprise" ? "Contact Enterprise" : `Claim ${tier.name} Pilot`}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist funnel */}
      <section id="waitlist" className="border-t border-slate-800/80 py-20">
        <div className="mx-auto max-w-2xl px-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl backdrop-blur sm:p-10">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                <ShieldCheck className="h-4 w-4" /> Founding Member Pilot
              </span>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Unblock Your Enterprise Deal Today
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Register with your business email. We will complete your first
                live security questionnaire for free within 2 hours.
              </p>
            </div>

            {submissionStatus === "success" ? (
              <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
                <h3 className="mt-3 text-base font-semibold text-white">
                  Priority Registration Confirmed
                </h3>
                <p className="mt-2 text-xs text-slate-300">
                  Check your inbox. Reply to our confirmation email with your
                  pending .xlsx questionnaire, and we will return the completed
                  file with citations in under 2 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div>
                  <label htmlFor="workEmail" className="block text-xs font-medium text-slate-300">
                    Work Email Address
                  </label>
                  <input
                    id="workEmail"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={formData.workEmail}
                    onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="companyName" className="block text-xs font-medium text-slate-300">
                      Company Name
                    </label>
                    <input
                      id="companyName"
                      type="text"
                      required
                      placeholder="Acme Inc."
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="dealSizeTier" className="block text-xs font-medium text-slate-300">
                      Target Deal Size
                    </label>
                    <select
                      id="dealSizeTier"
                      value={formData.dealSizeTier}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dealSizeTier: e.target.value as WaitlistSubmissionInput["dealSizeTier"],
                        })
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="under_25k">&lt; $25,000 ACV</option>
                      <option value="25k_to_100k">$25,000 – $100,000 ACV</option>
                      <option value="over_100k">&gt; $100,000 Enterprise ACV</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="currentBottleneck" className="block text-xs font-medium text-slate-300">
                    Who handles vendor reviews today?
                  </label>
                  <select
                    id="currentBottleneck"
                    value={formData.currentBottleneck}
                    onChange={(e) =>
                      setFormData({ ...formData, currentBottleneck: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  >
                    {BOTTLENECKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="block text-xs font-medium text-slate-300">
                    Existing Compliance Documentation
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {FRAMEWORKS.map((framework) => {
                      const active = formData.complianceFrameworks.includes(framework);
                      return (
                        <button
                          type="button"
                          key={framework}
                          onClick={() => handleFrameworkToggle(framework)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
                            active
                              ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                              : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          <div
                            className={`h-3 w-3 rounded-sm border ${
                              active ? "border-indigo-500 bg-indigo-500" : "border-slate-700"
                            }`}
                          />
                          {framework}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {submissionStatus === "error" && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-900/50 bg-rose-950/30 p-3 text-xs text-rose-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isPending}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Qualifying Application...
                    </>
                  ) : (
                    <>
                      Claim Free Questionnaire Pilot
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-slate-800/80 bg-slate-900/20 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Frequently Asked Questions
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Security & Trust
            </p>
          </div>
          <div className="mt-12 space-y-4">
            {FAQ_ITEMS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-xl border border-slate-800 bg-slate-900/50 p-5"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100 marker:hidden [&::-webkit-details-marker]:hidden">
                  {faq.q}
                </summary>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-12 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            <span className="font-semibold text-slate-300">TrustSync.ai</span>
            <span>— The Automated B2B Security Questionnaire Engine</span>
          </div>
          <div className="flex gap-6">
            <a href="#features" className="hover:text-slate-300">How It Works</a>
            <a href="#pricing" className="hover:text-slate-300">Pricing</a>
            <a href="#faq" className="hover:text-slate-300">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: "Does TrustSync train AI models on our proprietary security data?",
    a: "Never. Your compliance documents, SOC 2 reports, and filled questionnaires are encrypted at rest and isolated via strict multi-tenant Row-Level Security. We use enterprise zero-data-retention APIs where customer data is never used for training.",
  },
  {
    q: "What happens if our compliance docs don't answer a specific question?",
    a: "TrustSync never hallucinates answers. If your ingested documentation lacks evidence for a specific control, the engine flags the item with a low confidence score, marks it as 'Information Not Found', and prompts your team for human review.",
  },
  {
    q: "Can we export back to the original spreadsheet format?",
    a: "Yes. TrustSync reads and mutates your prospect's original binary .xlsx file. Merged cells, custom colors, dropdown data validations, and spreadsheet formulas remain intact.",
  },
  {
    q: "How does the Founding Member Plan work?",
    a: "Our first 20 beta customers receive full access for $499/month locked in for life, including unlimited questionnaire completions during your first 60 days and priority onboarding support.",
  },
];
