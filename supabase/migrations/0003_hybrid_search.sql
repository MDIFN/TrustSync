-- Hybrid vector + keyword search with Reciprocal Rank Fusion (RRF).
-- Pure vector search misses exact compliance codes ("SOC 2 CC6.1");
-- pure keyword search misses semantic nuance. RRF combines both.

-- Generated tsvector column for fast full-text keyword matching
alter table document_chunks
  add column if not exists fts_tokens tsvector
  generated always as (to_tsvector('english', content)) stored;

-- GIN index for high-speed keyword retrieval
create index if not exists idx_chunks_fts
  on document_chunks using gin (fts_tokens);

-- Stored function: hybrid search using Reciprocal Rank Fusion
create or replace function get_hybrid_chunks(
  p_query_text text,
  p_query_embedding vector(1536),
  p_org_id uuid,
  p_match_count integer default 5,
  p_rrf_k integer default 60
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  content text,
  similarity_score float,
  combined_rank float
)
language sql
stable
set search_path = public
as $$
  with
  -- 1. Dense semantic vector search (pgvector HNSW index)
  vector_matches as (
    select
      c.id,
      c.document_id,
      c.content,
      (1 - (c.embedding <=> p_query_embedding)) as sim_score,
      row_number() over (order by c.embedding <=> p_query_embedding) as rank_v
    from document_chunks c
    where c.org_id = p_org_id
    order by c.embedding <=> p_query_embedding
    limit 25
  ),
  -- 2. Sparse lexical search (PostgreSQL full-text search)
  text_matches as (
    select
      c.id,
      c.document_id,
      c.content,
      ts_rank_cd(c.fts_tokens, plainto_tsquery('english', p_query_text)) as text_rank,
      row_number() over (
        order by ts_rank_cd(c.fts_tokens, plainto_tsquery('english', p_query_text)) desc
      ) as rank_t
    from document_chunks c
    where c.org_id = p_org_id
      and c.fts_tokens @@ plainto_tsquery('english', p_query_text)
    limit 25
  ),
  -- 3. Reciprocal Rank Fusion (RRF) join & scoring
  combined as (
    select
      coalesce(v.id, t.id) as id,
      coalesce(v.document_id, t.document_id) as document_id,
      coalesce(v.content, t.content) as content,
      coalesce(v.sim_score, 0.0)::float as sim_score,
      (
        coalesce(1.0 / (p_rrf_k + v.rank_v), 0.0) +
        coalesce(1.0 / (p_rrf_k + t.rank_t), 0.0)
      )::float as fusion_score
    from vector_matches v
    full outer join text_matches t on v.id = t.id
  )
  -- 4. Final projection with document metadata
  select
    cb.id as chunk_id,
    cb.document_id,
    d.title as document_title,
    cb.content,
    cb.sim_score as similarity_score,
    cb.fusion_score as combined_rank
  from combined cb
  join compliance_documents d on d.id = cb.document_id
  order by cb.fusion_score desc
  limit p_match_count;
$$;
