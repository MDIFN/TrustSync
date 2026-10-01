import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuestionnaireWorkspace } from "@/components/questionnaire-workspace";

export const dynamic = "force-dynamic";

export default async function QuestionnaireReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: questionnaire } = await supabase
    .from("questionnaires")
    .select("id, title, status, total_questions, completed_questions")
    .eq("id", id)
    .single();

  if (!questionnaire) notFound();

  const { data: items } = await supabase
    .from("questionnaire_items")
    .select(
      "id, sheet_name, row_index, question_text, section_category, suggested_answer, human_approved_answer, confidence_score, review_status, citation_chunk_ids",
    )
    .eq("questionnaire_id", id)
    .order("sheet_name")
    .order("row_index");

  // Hydrate citation details (document title + excerpt) for cited chunks
  const citationIds = [
    ...new Set((items ?? []).flatMap((item) => item.citation_chunk_ids ?? [])),
  ];
  const citationMap: Record<
    string,
    { documentTitle: string; snippet: string; similarity: number }
  > = {};

  if (citationIds.length > 0) {
    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("id, content, metadata, compliance_documents(title)")
      .in("id", citationIds as string[]);
    for (const chunk of chunks ?? []) {
      const doc = chunk.compliance_documents as unknown as { title: string } | null;
      citationMap[chunk.id as string] = {
        documentTitle: doc?.title ?? "Unknown document",
        snippet:
          chunk.content.length > 400 ? `${chunk.content.slice(0, 400)}...` : chunk.content,
        similarity: 0,
      };
    }
  }

  const serializedItems = (items ?? []).map((item) => ({
    id: item.id,
    sheetName: item.sheet_name,
    rowIndex: item.row_index,
    questionText: item.question_text,
    sectionCategory: item.section_category,
    suggestedAnswer: item.suggested_answer ?? "",
    confidenceScore: item.confidence_score ? Number(item.confidence_score) : null,
    reviewStatus: item.review_status as
      | "pending"
      | "approved"
      | "edited"
      | "flagged",
    citations: (item.citation_chunk_ids ?? [])
      .map((chunkId: string) => ({
        id: chunkId,
        ...(citationMap[chunkId] ?? {
          documentTitle: "Citation",
          snippet: "Source excerpt unavailable.",
          similarity: 0,
        }),
      }))
      .slice(0, 3),
  }));

  return (
    <QuestionnaireWorkspace
      questionnaireId={questionnaire.id}
      title={questionnaire.title}
      initialStatus={questionnaire.status}
      initialItems={serializedItems}
    />
  );
}
