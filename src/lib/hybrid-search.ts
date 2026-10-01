import { createAdminClient } from "@/lib/supabase/admin";
import { createAdminOpenAI } from "@/lib/openai-admin";

export interface HybridChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  similarityScore: number;
  combinedRank: number;
}

/**
 * Embeds the query text and executes the get_hybrid_chunks RPC (Reciprocal
 * Rank Fusion of pgvector cosine similarity + tsvector keyword matching).
 *
 * Uses the admin client because the RPC filters tenants explicitly via
 * p_org_id, and it runs inside background workers where no user session
 * exists.
 */
export async function getHybridChunks(
  queryText: string,
  orgId: string,
  matchCount: number = 5,
): Promise<HybridChunk[]> {
  const openai = createAdminOpenAI();
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: queryText,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.rpc("get_hybrid_chunks", {
    p_query_text: queryText,
    p_query_embedding: queryEmbedding,
    p_org_id: orgId,
    p_match_count: matchCount,
  });

  if (error) {
    throw new Error(`Hybrid search failed: ${error.message}`);
  }

  return (data ?? []).map(
    (row: {
      chunk_id: string;
      document_id: string;
      document_title: string;
      content: string;
      similarity_score: number;
      combined_rank: number;
    }) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      content: row.content,
      similarityScore: row.similarity_score,
      combinedRank: row.combined_rank,
    }),
  );
}
