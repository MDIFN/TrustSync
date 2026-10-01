"use server";

import { inngest } from "@/lib/inngest";
import { createClient } from "@/lib/supabase/server";

export interface UploadDocumentResult {
  success: boolean;
  error?: string;
  documentId?: string;
}

/**
 * Uploads a compliance document (SOC 2 report, ISO cert, policy PDF/DOCX) to
 * storage and registers it. Parsing + embedding happens in the Inngest
 * background worker to avoid serverless timeouts on 100+ page reports.
 */
export async function uploadComplianceDocumentAction(
  formData: FormData,
): Promise<UploadDocumentResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "No file uploaded." };
  }

  const validExtensions = [".pdf", ".docx", ".txt", ".md"];
  const lowerName = file.name.toLowerCase();
  if (!validExtensions.some((ext) => lowerName.endsWith(ext))) {
    return { success: false, error: "Only PDF, DOCX, TXT and MD files are supported." };
  }

  // 25 MB cap keeps serverless memory and embedding costs sane
  if (file.size > 25 * 1024 * 1024) {
    return { success: false, error: "File exceeds the 25 MB limit." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile?.org_id) {
    return { success: false, error: "No organization profile found." };
  }
  const orgId = profile.org_id as string;

  // Store raw file under the org prefix (storage RLS enforces the same scope)
  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const safeName = file.name.replace(/[^\w.\- ]/g, "_");
  const storageFilePath = `${orgId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("compliance_documents")
    .upload(storageFilePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
    });
  if (uploadError) {
    return { success: false, error: `Storage upload failed: ${uploadError.message}` };
  }

  // Register document record
  const { data: docRecord, error: docError } = await supabase
    .from("compliance_documents")
    .insert({
      org_id: orgId,
      title: safeName.replace(/\.[^/.]+$/, ""),
      file_path: storageFilePath,
      file_type: lowerName.split(".").pop() ?? "unknown",
      file_size_bytes: file.size,
      status: "processing",
    })
    .select("id")
    .single();

  if (docError || !docRecord) {
    return { success: false, error: `Database write failed: ${docError?.message}` };
  }

  // Trigger background parsing + embedding pipeline
  await inngest.send({
    name: "compliance/document.ingested",
    data: {
      documentId: docRecord.id,
      orgId,
      filePath: storageFilePath,
      fileName: safeName,
    },
  });

  return { success: true, documentId: docRecord.id };
}
