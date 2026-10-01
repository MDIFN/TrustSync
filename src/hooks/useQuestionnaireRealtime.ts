"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface WorkspaceItem {
  id: string;
  sheetName: string;
  rowIndex: number;
  questionText: string;
  sectionCategory: string | null;
  suggestedAnswer: string;
  confidenceScore: number | null;
  reviewStatus: "pending" | "approved" | "edited" | "flagged";
  citations: {
    id: string;
    documentTitle: string;
    snippet: string;
    similarity: number;
  }[];
}

interface RealtimeItemRow {
  id: string;
  sheet_name: string;
  row_index: number;
  question_text: string;
  section_category: string | null;
  suggested_answer: string | null;
  confidence_score: string | number | null;
  review_status: "pending" | "approved" | "edited" | "flagged";
  citation_chunk_ids: string[] | null;
}

/**
 * Subscribes to UPDATE events on questionnaire_items for this questionnaire
 * and merges them into local state live as Inngest workers save Claude
 * evaluations. Falls back gracefully when Realtime is unavailable.
 */
export function useQuestionnaireRealtime({
  questionnaireId,
  initialItems,
}: {
  questionnaireId: string;
  initialItems: WorkspaceItem[];
}) {
  const [items, setItems] = useState<WorkspaceItem[]>(initialItems);
  const [isConnected, setIsConnected] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Hydrate from the server payload whenever navigation replaces it
    setItems(initialItems);

    const channel = supabase
      .channel(`questionnaire:${questionnaireId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "questionnaire_items",
          filter: `questionnaire_id=eq.${questionnaireId}`,
        },
        (payload) => {
          const updated = payload.new as RealtimeItemRow;
          setItems((prev) =>
            prev.map((item) =>
              item.id === updated.id
                ? {
                    ...item,
                    suggestedAnswer: updated.suggested_answer ?? "",
                    confidenceScore:
                      updated.confidence_score !== null
                        ? Number(updated.confidence_score)
                        : null,
                    reviewStatus: updated.review_status,
                  }
                : item,
            ),
          );
        },
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [questionnaireId, initialItems, supabase]);

  const progress = useMemo(() => {
    if (items.length === 0) return 0;
    const drafted = items.filter((i) => i.reviewStatus !== "pending").length;
    return Math.min(100, Math.round((drafted / items.length) * 100));
  }, [items]);

  const counts = useMemo(
    () => ({
      approved: items.filter((i) => i.reviewStatus === "approved").length,
      flagged: items.filter((i) => i.reviewStatus === "flagged").length,
      pending: items.filter((i) => i.reviewStatus === "pending").length,
      edited: items.filter((i) => i.reviewStatus === "edited").length,
    }),
    [items],
  );

  return { items, setItems, isConnected, progress, counts };
}
