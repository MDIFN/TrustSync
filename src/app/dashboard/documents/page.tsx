import { FileText, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DocumentUpload } from "@/components/document-upload";

export const dynamic = "force-dynamic";

const STATUS_ICON: Record<string, React.ReactNode> = {
  ready: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  processing: <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />,
  failed: <XCircle className="h-4 w-4 text-rose-400" />,
};

export default async function DocumentsPage() {
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from("compliance_documents")
    .select("id, title, file_type, file_size_bytes, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Knowledge Base</h1>
        <p className="mt-1 text-xs text-slate-400">
          Upload SOC 2 reports, ISO certificates, pen-test summaries, and
          security policies. Every questionnaire answer cites these documents.
        </p>
      </div>

      <DocumentUpload />

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/60 text-xs text-slate-400">
            <tr>
              <th className="px-6 py-3.5">Document</th>
              <th className="px-4 py-3.5">Type</th>
              <th className="px-4 py-3.5">Size</th>
              <th className="px-6 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {(documents ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-xs text-slate-500">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-slate-700" />
                  No documents yet. Upload your SOC 2 report to bootstrap the knowledge base.
                </td>
              </tr>
            ) : (
              (documents ?? []).map((doc) => (
                <tr key={doc.id} className="transition hover:bg-slate-900/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 shrink-0 text-indigo-400" />
                      <span className="max-w-xs truncate font-medium text-slate-200">
                        {doc.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs uppercase text-slate-400">{doc.file_type}</td>
                  <td className="px-4 py-4 text-xs text-slate-400">
                    {doc.file_size_bytes
                      ? `${(doc.file_size_bytes / 1024 / 1024).toFixed(1)} MB`
                      : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-2 text-xs capitalize text-slate-300">
                      {STATUS_ICON[doc.status]}
                      {doc.status}
                    </span>
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
