"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { uploadQuestionnaireAction } from "@/app/actions/uploadQuestionnaire";

export function QuestionnaireUpload() {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await uploadQuestionnaireAction(formData);
      if (result.success && result.questionnaireId) {
        setSuccess(
          `Queued ${result.totalQuestions} questions. Redirecting to the review workspace...`,
        );
        formRef.current?.reset();
        // Give the realtime worker a beat, then land on the workspace
        setTimeout(() => {
          router.push(`/dashboard/questionnaires/${result.questionnaireId}`);
        }, 1200);
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
          <label htmlFor="file" className="block text-xs font-medium text-slate-300">
            Vendor questionnaire (.xlsx / .csv)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            required
            accept=".xlsx,.xlsm,.csv"
            className="mt-1.5 block w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-300 file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-200 hover:file:bg-slate-700"
          />
        </div>
        <div className="sm:w-48">
          <label htmlFor="companyName" className="block text-xs font-medium text-slate-300">
            Prospect company
          </label>
          <input
            id="companyName"
            name="companyName"
            type="text"
            placeholder="Acme Enterprise"
            className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Queuing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> Upload &amp; Auto-Fill
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-900/50 bg-rose-950/30 p-3 text-xs text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-900/50 bg-emerald-950/30 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
    </form>
  );
}
