"use server";

import { inngest } from "@/lib/inngest";
import { SpreadsheetProcessor } from "@/lib/spreadsheet-processor";
import { createClient } from "@/lib/supabase/server";

export interface UploadQuestionnaireResult {
  success: boolean;
  error?: string;
  questionnaireId?: string;
  totalQuestions?: number;
}

/**
 * Handles questionnaire upload: stores the original binary, extracts question
 * rows via SheetJS, seeds the DB, and dispatches the background processing
 * event to Inngest. Returns control to the browser in under 2 seconds — the
 * heavy RAG + inference work happens in the background worker.
 */
export async function uploadQuestionnaireAction(
  formData: FormData,
): Promise<UploadQuestionnaireResult> {
  const file = formData.get("file");
  const companyName = (formData.get("companyName") as string) || "Acme SaaS";
  if (!(file instanceof File)) {
    return { success: false, error: "No file uploaded." };
  }

  const validExtensions = [".xlsx", ".xlsm", ".csv"];
  const lowerName = file.name.toLowerCase();
  if (!validExtensions.some((ext) => lowerName.endsWith(ext))) {
    return { success: false, error: "Only .xlsx, .xlsm and .csv files are supported." };
  }

  const supabase = await createClient();

  // 1. Authenticate user
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { success: false, error: "Unauthorized." };
  }

  // 2. Resolve organization ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, organizations(name)")
    .eq("id", user.id)
    .single();
  if (!profile?.org_id) {
    return { success: false, error: "No organization profile found." };
  }
  const orgId = profile.org_id as string;
  const orgName =
    (profile.organizations as unknown as { name: string } | null)?.name ?? companyName;

  // 3. Read binary and parse questions
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  let parsedItems;
  try {
    parsedItems = SpreadsheetProcessor.parseQuestionnaire(fileBuffer);
  } catch {
    return { success: false, error: "Could not parse the spreadsheet." };
  }

  if (parsedItems.length === 0) {
    return {
      success: false,
      error: "No unanswered questions detected. Check the file has questions in column A and empty answers in column B.",
    };
  }

  // 4. Upload raw file to the private Supabase Storage bucket
  const storageFilePath = `${orgId}/${Date.now()}_${file.name.replace(/[^\w.\- ]/g, "_")}`;
  const { error: uploadError } = await supabase.storage
    .from("questionnaire_files")
    .upload(storageFilePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
    });
  if (uploadError) {
    return { success: false, error: `Storage upload failed: ${uploadError.message}` };
  }

  // 5. Create parent questionnaire record
  const { data: qRecord, error: qError } = await supabase
    .from("questionnaires")
    .insert({
      org_id: orgId,
      title: file.name,
      source_file_path: storageFilePath,
      total_questions: parsedItems.length,
      status: "parsing",
    })
    .select("id")
    .single();

  if (qError || !qRecord) {
    return { success: false, error: `Database write failed: ${qError?.message}` };
  }

  // 6. Batch insert parsed questions
  const rows = parsedItems.map((item) => ({
    questionnaire_id: qRecord.id,
    org_id: orgId,
    sheet_name: item.sheetName,
    row_index: item.rowIndex,
    question_text: item.questionText,
    section_category: item.sectionCategory,
    review_status: "pending",
  }));

  const ITEMS_PER_CHUNK = 500;
  for (let i = 0; i < rows.length; i += ITEMS_PER_CHUNK) {
    const { error: itemsError } = await supabase
      .from("questionnaire_items")
      .insert(rows.slice(i, i + ITEMS_PER_CHUNK));
    if (itemsError) {
      return {
        success: false,
        error: `Question insert failed: ${itemsError.message}`,
      };
    }
  }

  // 7. Dispatch background processing event to Inngest
  await inngest.send({
    name: "questionnaire/process.requested",
    data: {
      questionnaireId: qRecord.id,
      orgId,
      orgName,
      companyName,
      sourceFileName: file.name,
      totalQuestions: parsedItems.length,
    },
  });

  return {
    success: true,
    questionnaireId: qRecord.id,
    totalQuestions: parsedItems.length,
  };
}
