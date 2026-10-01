"use server";

import { createClient } from "@/lib/supabase/server";

export type ReviewStatus = "pending" | "approved" | "edited" | "flagged";

/**
 * Persists a human review decision on a single questionnaire item.
 * RLS guarantees the caller can only touch rows inside their own org.
 */
export async function saveItemReview(
  itemId: string,
  updatedAnswer: string,
  status: ReviewStatus,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized." };
  }

  const updates: Record<string, unknown> = { review_status: status };
  if (status === "edited") {
    updates.suggested_answer = updatedAnswer;
  }
  // Capture the human-verified answer for export on approve/edit
  if (status === "approved" || status === "edited") {
    updates.human_approved_answer = updatedAnswer;
  }

  const { error } = await supabase
    .from("questionnaire_items")
    .update(updates)
    .eq("id", itemId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Batch-approves every item above the confidence threshold in one click.
 */
export async function approveHighConfidenceItems(
  questionnaireId: string,
  threshold: number = 0.8,
): Promise<{ success: boolean; approvedCount?: number; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized." };
  }

  const { data: items, error: fetchError } = await supabase
    .from("questionnaire_items")
    .select("id, suggested_answer")
    .eq("questionnaire_id", questionnaireId)
    .eq("review_status", "pending")
    .gte("confidence_score", threshold);

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }
  if (!items || items.length === 0) {
    return { success: true, approvedCount: 0 };
  }

  // Apply sequentially through RLS-scoped updates
  let approved = 0;
  for (const item of items) {
    const { error } = await supabase
      .from("questionnaire_items")
      .update({
        review_status: "approved",
        human_approved_answer: item.suggested_answer,
      })
      .eq("id", item.id);
    if (!error) approved++;
  }

  return { success: true, approvedCount: approved };
}
