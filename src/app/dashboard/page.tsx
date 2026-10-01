import Link from "next/link";
import { FileSpreadsheet, ArrowRight, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { QuestionnaireUpload } from "@/components/questionnaire-upload";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  uploaded: "bg-slate-800 text-slate-300",
  parsing: "bg-indigo-500/10 text-indigo-300",
  drafting: "bg-indigo-500/10 text-indigo-300",
  completed: "bg-emerald-500/10 text-emerald-300",
  failed: "bg-rose-500/10 text-rose-300",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: questionnaires } = await supabase
    .from("questionnaires")
    .select("id, title, status, total_questions, completed_questions, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const { count: documentCount } = await supabase
    .from("compliance_documents")
    .select("id", { count: "exact", head: true });

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Questionnaires
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Upload a vendor security spreadsheet. TrustSync drafts answers with
            citations; you review and export.
          </p>
        </div>
        <Link
          href="/dashboard/documents"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:text-white"
        >
          <FileText className="h-4 w-4 text-indigo-400" />
          Knowledge Base ({documentCount ?? 0} docs)
        </Link>
      </div>

      <QuestionnaireUpload />

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/60 text-xs text-slate-400">
            <tr>
              <th className="px-6 py-3.5">Questionnaire</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Progress</th>
              <th className="px-6 py-3.5 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {(questionnaires ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-xs text-slate-500">
                  <FileSpreadsheet className="mx-auto mb-3 h-8 w-8 text-slate-700" />
                  No questionnaires yet. Upload your first vendor spreadsheet above.
                </td>
              </tr>
            ) : (
              (questionnaires ?? []).map((q) => (
                <tr key={q.id} className="transition hover:bg-slate-900/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span className="max-w-xs truncate font-medium text-slate-200">
                        {q.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${
                        STATUS_STYLES[q.status] ?? "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-400">
                    {q.completed_questions} / {q.total_questions} drafted
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/dashboard/questionnaires/${q.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 transition hover:text-indigo-300"
                    >
                      Review <ArrowRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
