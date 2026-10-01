import { inngest } from "@/lib/inngest";
import { ComplianceInferenceEngine } from "@/lib/inference-engine";
import { getHybridChunks } from "@/lib/hybrid-search";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Background questionnaire processor: runs hybrid retrieval + Claude
 * inference in batches of 5, respecting Anthropic rate limits and org-level
 * concurrency caps. Streams progress to the review UI via Supabase Realtime
 * (every item update fires a postgres_changes event).
 */
export const processQuestionnaireJob = inngest.createFunction(
  {
    id: "process-questionnaire-job",
    name: "Process Enterprise Security Questionnaire",
    // Concurrency control: max 2 simultaneous files per customer tenant
    concurrency: [
      {
        scope: "account",
        key: "event.data.orgId",
        limit: 2,
      },
    ],
    retries: 3,
    onFailure: async ({ event, error }) => {
      const questionnaireId = event.data.event.data.questionnaireId;
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin
        .from("questionnaires")
        .update({ status: "failed" })
        .eq("id", questionnaireId);
      console.error(
        `[process-questionnaire-job] permanently failed: ${questionnaireId}`,
        error,
      );
    },
    triggers: [{ event: "questionnaire/process.requested" }],
  },
  async ({ event, step }) => {
    const { questionnaireId, orgId, orgName, companyName } = event.data;
    const supabaseAdmin = createAdminClient();

    // 1. Mark status as 'drafting' in PostgreSQL
    await step.run("set-status-drafting", async () => {
      await supabaseAdmin
        .from("questionnaires")
        .update({ status: "drafting" })
        .eq("id", questionnaireId);
    });

    // 2. Fetch all pending questions
    const items = await step.run("fetch-question-items", async () => {
      const { data, error } = await supabaseAdmin
        .from("questionnaire_items")
        .select("id, question_text, section_category")
        .eq("questionnaire_id", questionnaireId)
        .eq("review_status", "pending")
        .order("row_index", { ascending: true });

      if (error) throw new Error(`Database query failed: ${error.message}`);
      return data || [];
    });

    if (items.length === 0) {
      return { message: "No pending questions to process.", questionnaireId };
    }

    // Bail out early when no compliance collateral has been ingested yet:
    // every answer would be "Information Not Found", so flag for review
    // instead of burning inference tokens.
    const { count: chunkCount } = await step.run("check-knowledge-base", async () => {
      const { count } = await supabaseAdmin
        .from("document_chunks")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId);
      return { count: count ?? 0 };
    });

    if (chunkCount === 0) {
      await step.run("flag-all-no-knowledge-base", async () => {
        await supabaseAdmin
          .from("questionnaire_items")
          .update({ review_status: "flagged", suggested_answer: "Information Not Found" })
          .eq("questionnaire_id", questionnaireId)
          .eq("review_status", "pending");
        await supabaseAdmin
          .from("questionnaires")
          .update({ status: "completed", completed_questions: items.length })
          .eq("id", questionnaireId);
      });
      return {
        success: true,
        questionnaireId,
        processedCount: 0,
        note: "No compliance documents ingested; all items flagged for manual answer.",
      };
    }

    const inferenceEngine = new ComplianceInferenceEngine(process.env.ANTHROPIC_API_KEY!);
    const BATCH_SIZE = 5; // Balanced for Anthropic Tier-2 rate limits

    // 3. Process items in parallel batches
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const currentBatch = items.slice(i, i + BATCH_SIZE);
      const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(items.length / BATCH_SIZE);

      await step.run(`process-batch-${batchIndex}-of-${totalBatches}`, async () => {
        await Promise.all(
          currentBatch.map(async (item) => {
            // Retrieve top-5 compliance chunks using hybrid search
            const chunks = await getHybridChunks(item.question_text, orgId, 5);

            // Zero-hallucination Claude evaluation with citation guardrails
            const evaluated = await inferenceEngine.generateAuditedAnswer(
              item.question_text,
              item.section_category,
              chunks,
              companyName || orgName,
            );

            // Write results and citations back to PostgreSQL (fires Realtime)
            await supabaseAdmin
              .from("questionnaire_items")
              .update({
                suggested_answer: evaluated.suggestedAnswer,
                confidence_score: evaluated.confidenceScore,
                review_status: evaluated.reviewStatus,
                citation_chunk_ids: evaluated.citationChunkIds,
              })
              .eq("id", item.id);
          }),
        );
      });
    }

    // 4. Update overall questionnaire completion stats
    await step.run("finalize-questionnaire-state", async () => {
      await supabaseAdmin
        .from("questionnaires")
        .update({
          status: "completed",
          completed_questions: items.length,
        })
        .eq("id", questionnaireId);
    });

    return {
      success: true,
      questionnaireId,
      processedCount: items.length,
    };
  },
);
