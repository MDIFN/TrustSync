import { inngest } from "@/lib/inngest";
import { ComplianceDocumentParser } from "@/lib/compliance-parser";
import { createAdminOpenAI } from "@/lib/openai-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const EMBEDDING_BATCH_SIZE = 16;

/**
 * Background ingestion: parses a compliance document (PDF/DOCX/TXT/MD) into
 * header-aware chunks, generates text-embedding-3-small vectors in batches,
 * and writes them to document_chunks. Marks the parent document ready or
 * failed so the UI can reflect state.
 */
export const ingestComplianceDocument = inngest.createFunction(
  {
    id: "ingest-compliance-document",
    name: "Ingest Compliance Document",
    retries: 3,
    onFailure: async ({ event, error }) => {
      const { documentId } = event.data.event.data;
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin
        .from("compliance_documents")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message.slice(0, 500) : "Ingestion failed",
        })
        .eq("id", documentId);
    },
    triggers: [{ event: "compliance/document.ingested" }],
  },
  async ({ event, step }) => {
    const { documentId, orgId, filePath, fileName } = event.data;
    const supabaseAdmin = createAdminClient();

    // 1. Download the raw file from storage (base64 survives JSON step serialization)
    const fileBase64 = await step.run("download-file", async () => {
      const { data, error } = await supabaseAdmin.storage
        .from("compliance_documents")
        .download(filePath);
      if (error || !data) {
        throw new Error(`Storage download failed: ${error?.message}`);
      }
      return Buffer.from(await data.arrayBuffer()).toString("base64");
    });

    // 2. Parse into header-aware chunks
    const parsed = await step.run("parse-document", async () => {
      const fileBuffer = Buffer.from(fileBase64, "base64");
      const result = await ComplianceDocumentParser.parseDocument(fileBuffer, fileName);
      if (result.chunks.length === 0) {
        throw new Error("Document produced zero chunks — is the file readable text?");
      }
      return {
        totalTokens: result.totalTokens,
        chunks: result.chunks,
      };
    });

    // 3. Generate embeddings and insert in batches
    const openai = createAdminOpenAI();
    let inserted = 0;

    for (let i = 0; i < parsed.chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const slice = parsed.chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const batchNumber = Math.floor(i / EMBEDDING_BATCH_SIZE) + 1;

      await step.run(`embed-and-insert-batch-${batchNumber}`, async () => {
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: slice.map((c) => c.content),
        });

        const rowsToInsert = slice.map((chunk, index) => ({
          document_id: documentId,
          org_id: orgId,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          token_count: chunk.tokenCount,
          metadata: {
            section: chunk.sectionHeader,
            source_file: fileName,
          },
          embedding: embeddingResponse.data[index].embedding,
        }));

        const { error: insertError } = await supabaseAdmin
          .from("document_chunks")
          .insert(rowsToInsert);

        if (insertError) {
          throw new Error(`Chunk insert failed: ${insertError.message}`);
        }
        return slice.length;
      });

      inserted += slice.length;
    }

    // 4. Mark the parent document as ready
    await step.run("mark-ready", async () => {
      await supabaseAdmin
        .from("compliance_documents")
        .update({ status: "ready" })
        .eq("id", documentId);
    });

    return {
      success: true,
      documentId,
      totalChunks: inserted,
      totalTokens: parsed.totalTokens,
    };
  },
);
