"use server";

import { SpreadsheetProcessor, type AnswerPayload } from "@/lib/spreadsheet-processor";
import { createClient } from "@/lib/supabase/server";

export interface ExportResult {
  success: boolean;
  fileBase64?: string;
  fileName?: string;
  error?: string;
}

/**
 * Loads the original questionnaire binary from Storage, mutates it with all
 * approved/edited answers via the non-destructive SheetJS writer, and returns
 * the completed .xlsx as base64 for browser download.
 */
export async function exportQuestionnaireAction(
  questionnaireId: string,
): Promise<ExportResult> {
  const supabase = await createClient();

  // 1. Authenticate user & extract tenant boundary
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "Unauthorized access." };
  }

  // 2. Fetch questionnaire (RLS scopes this to the caller's org)
  const { data: questionnaire, error: qError } = await supabase
    .from("questionnaires")
    .select("id, title, source_file_path, org_id")
    .eq("id", questionnaireId)
    .single();

  if (qError || !questionnaire) {
    return { success: false, error: "Questionnaire not found." };
  }

  // 3. Fetch approved or edited answers
  const { data: items, error: itemsError } = await supabase
    .from("questionnaire_items")
    .select("sheet_name, row_index, suggested_answer, human_approved_answer, review_status")
    .eq("questionnaire_id", questionnaireId)
    .in("review_status", ["approved", "edited"]);

  if (itemsError || !items || items.length === 0) {
    return { success: false, error: "No approved responses found to export." };
  }

  // 4. Download original source spreadsheet from Supabase Storage
  const { data: fileData, error: storageError } = await supabase.storage
    .from("questionnaire_files")
    .download(questionnaire.source_file_path);

  if (storageError || !fileData) {
    return { success: false, error: "Failed to load original workbook template." };
  }

  const originalBuffer = Buffer.from(await fileData.arrayBuffer());

  // 5. Map approved answers to the SheetJS payload structure
  // Answer column defaults to B; ingestion records the resolved column per
  // sheet when custom mappings are introduced.
  const approvedPayloads: AnswerPayload[] = items.map((item) => ({
    sheetName: item.sheet_name,
    rowIndex: item.row_index,
    answerCol: "B",
    answerText: item.human_approved_answer || item.suggested_answer || "",
  }));

  // 6. Mutate binary using the non-destructive SheetJS writer
  let mutatedBuffer: Buffer;
  try {
    mutatedBuffer = SpreadsheetProcessor.writeAnswersToWorkbook(
      originalBuffer,
      approvedPayloads,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Workbook write failed";
    return { success: false, error: message };
  }

  return {
    success: true,
    fileBase64: mutatedBuffer.toString("base64"),
    fileName: `Completed_${questionnaire.title.replace(/\s+/g, "_")}`,
  };
}
