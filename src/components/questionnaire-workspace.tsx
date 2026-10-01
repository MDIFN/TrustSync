"use client";

import { useState } from "react";
import {
  Check,
  XCircle,
  AlertTriangle,
  Download,
  Loader2,
  Wifi,
  WifiOff,
  CheckCheck,
  FileText,
  ChevronDown,
} from "lucide-react";
import { saveItemReview, approveHighConfidenceItems } from "@/app/actions/reviewItem";
import { useQuestionnaireRealtime, type WorkspaceItem } from "@/hooks/useQuestionnaireRealtime";

interface WorkspaceProps {
  questionnaireId: string;
  title: string;
  initialStatus: string;
  initialItems: WorkspaceItem[];
}

const STATUS_BADGE: Record<WorkspaceItem["reviewStatus"], string> = {
  pending: "bg-slate-800 text-slate-300",
  approved: "bg-emerald-500/10 text-emerald-400",
  edited: "bg-cyan-500/10 text-cyan-300",
  flagged: "bg-rose-500/10 text-rose-400",
};

function confidenceBadge(score: number | null) {
  if (score === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-400">
        Drafting...
      </span>
    );
  }
  if (score >= 0.8) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-500">
        <Check className="h-3 w-3" /> {(score * 100).toFixed(0)}% High
      </span>
    );
  }
  if (score >= 0.6) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-500">
        <AlertTriangle className="h-3 w-3" /> {(score * 100).toFixed(0)}% Med
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-1 text-[10px] font-medium text-rose-500">
      <XCircle className="h-3 w-3" /> {(score * 100).toFixed(0)}% Low
    </span>
  );
}

export function QuestionnaireWorkspace({
  questionnaireId,
  title,
  initialStatus,
  initialItems,
}: WorkspaceProps) {
  const { items, setItems, isConnected, progress, counts } = useQuestionnaireRealtime({
    questionnaireId,
    initialItems,
  });
  const [selectedId, setSelectedId] = useState<string | null>(initialItems[0]?.id ?? null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  const updateLocal = (id: string, patch: Partial<WorkspaceItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleStatus = async (item: WorkspaceItem, status: WorkspaceItem["reviewStatus"]) => {
    setBusyId(item.id);
    const result = await saveItemReview(item.id, item.suggestedAnswer, status);
    setBusyId(null);
    if (result.success) {
      updateLocal(item.id, { reviewStatus: status });
    } else {
      setToast(result.error || "Save failed");
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleApproveAll = async () => {
    setBatchBusy(true);
    const result = await approveHighConfidenceItems(questionnaireId, 0.8);
    setBatchBusy(false);
    if (result.success) {
      setItems((prev) =>
        prev.map((item) =>
          item.reviewStatus === "pending" &&
          item.confidenceScore !== null &&
          item.confidenceScore >= 0.8
            ? { ...item, reviewStatus: "approved" }
            : item,
        ),
      );
      setToast(`Approved ${result.approvedCount ?? 0} high-confidence items`);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleExport = async () => {
    setExportBusy(true);
    setExportError(null);
    try {
      const response = await fetch(`/api/export/${questionnaireId}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Completed_${title.replace(/\s+/g, "_")}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Progress header */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-4 py-4 backdrop-blur sm:px-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="truncate text-lg font-bold text-slate-100">{title}</h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${
                  initialStatus === "completed"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-indigo-500/10 text-indigo-400"
                }`}
              >
                {initialStatus === "parsing" || initialStatus === "drafting" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : null}
                {initialStatus}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {items.length} controls · {counts.approved + counts.edited} ready for export ·{" "}
              {counts.flagged} flagged
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
              {isConnected ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" /> Realtime Live
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" /> Polling
                </>
              )}
            </span>
            <button
              type="button"
              onClick={handleApproveAll}
              disabled={batchBusy || counts.pending === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {batchBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
              )}
              Approve All ≥80%
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportBusy || counts.approved + counts.edited === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-[10px] font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-40"
            >
              {exportBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting...
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" /> Export Completed .xlsx
                </>
              )}
            </button>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden pt-4 lg:grid-cols-12">
        {/* Items table */}
        <div className="overflow-y-auto rounded-xl border border-slate-800 lg:col-span-7">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 text-[10px] uppercase tracking-wider text-slate-500 backdrop-blur">
              <tr>
                <th className="py-3 pl-4 pr-2">Sheet:Row</th>
                <th className="px-2 py-3">Question</th>
                <th className="px-2 py-3">Confidence</th>
                <th className="px-2 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`cursor-pointer transition hover:bg-slate-900/60 ${
                    selectedId === item.id ? "bg-slate-900" : ""
                  }`}
                >
                  <td className="whitespace-nowrap py-3 pl-4 pr-2 font-mono text-[10px] text-slate-500">
                    {item.sheetName}:R{item.rowIndex}
                  </td>
                  <td className="max-w-xs truncate px-2 py-3 text-slate-200">
                    {item.questionText}
                  </td>
                  <td className="px-2 py-3">{confidenceBadge(item.confidenceScore)}</td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_BADGE[item.reviewStatus]}`}
                    >
                      {item.reviewStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        <div className="flex flex-col gap-4 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/30 p-5 lg:col-span-5">
          {selectedItem ? (
            <>
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Target Question ({selectedItem.sheetName}:R{selectedItem.rowIndex})
                  {selectedItem.sectionCategory ? ` · ${selectedItem.sectionCategory}` : ""}
                </span>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-200">
                  {selectedItem.questionText}
                </p>
              </div>

              <div className="flex flex-1 flex-col rounded-lg border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Generated Response
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleStatus(selectedItem, "approved")}
                      disabled={busyId === selectedItem.id}
                      className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1 text-[10px] font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatus(selectedItem, "flagged")}
                      disabled={busyId === selectedItem.id}
                      className="inline-flex items-center gap-1 rounded bg-rose-600 px-3 py-1 text-[10px] font-medium text-white transition hover:bg-rose-500 disabled:opacity-50"
                    >
                      <AlertTriangle className="h-3 w-3" /> Flag
                    </button>
                  </div>
                </div>
                <textarea
                  value={selectedItem.suggestedAnswer}
                  onChange={(e) =>
                    updateLocal(selectedItem.id, {
                      suggestedAnswer: e.target.value,
                      reviewStatus:
                        selectedItem.reviewStatus === "pending" ? "edited" : selectedItem.reviewStatus,
                    })
                  }
                  onBlur={() => {
                    if (selectedItem.reviewStatus === "edited") {
                      void handleStatus(selectedItem, "edited");
                    }
                  }}
                  placeholder={
                    selectedItem.confidenceScore === null
                      ? "Drafting in progress — this field fills in live via realtime..."
                      : "No answer drafted. Type one manually, then Approve."
                  }
                  className="mt-1 w-full flex-1 resize-none rounded-md border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                  rows={8}
                />
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Substantiating Citations ({selectedItem.citations.length})
                </span>
                <div className="mt-3 space-y-2">
                  {selectedItem.citations.length > 0 ? (
                    selectedItem.citations.map((citation) => (
                      <div
                        key={citation.id}
                        className="rounded border border-slate-800 bg-slate-950 p-3 text-[10px]"
                      >
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-200">
                            <FileText className="h-3 w-3 shrink-0 text-indigo-400" />
                            <span className="truncate">{citation.documentTitle}</span>
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-4 font-serif italic text-slate-300">
                          “{citation.snippet}”
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded border border-dashed border-slate-800 p-4 text-center text-[10px] text-slate-500">
                      No citations yet. Items still drafting will populate live.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
              Select a question to inspect citations and verify answers.
            </div>
          )}
        </div>
      </div>

      {/* Toasts */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-xs text-slate-200 shadow-2xl">
          {toast}
        </div>
      )}
      {exportError && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-rose-900/50 bg-rose-950 px-4 py-3 text-xs text-rose-300 shadow-2xl">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {exportError}
          <button type="button" onClick={() => setExportError(null)}>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
