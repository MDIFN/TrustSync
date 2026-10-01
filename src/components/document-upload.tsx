"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, AlertTriangle } from "lucide-react";
import { uploadComplianceDocumentAction } from "@/app/actions/uploadDocument";

export function DocumentUpload() {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await uploadComplianceDocumentAction(formData);
      if (result.success) {
        formRef.current?.reset();
        router.refresh();
      } else {
        setError(result.error || "Upload failed.");
      }
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-800 bg-slate-900/50 p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="doc-file" className="block text-xs font-medium text-slate-300">
            Compliance document (PDF / DOCX / TXT / MD · max 25 MB)
          </label>
          <input
            id="doc-file"
            name="file"
            type="file"
            required
            accept=".pdf,.docx,.txt,.md"
            className="mt-1.5 block w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-300 file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-200 hover:file:bg-slate-700"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Ingesting...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> Ingest Document
            </>
          )}
        </button>
      </div>
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-900/50 bg-rose-950/30 p-3 text-xs text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
    </form>
  );
}
