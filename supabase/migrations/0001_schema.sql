-- TrustSync schema: multi-tenant tables + Row-Level Security.
-- Run against a Supabase project (Dashboard SQL editor or `supabase db push`).

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ============================================================
-- 1. Organizations (tenant boundary)
-- ============================================================
create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  billing_status text default 'trialing'
    check (billing_status in ('trialing', 'active', 'past_due', 'canceled')),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 2. User profiles mapped to Supabase Auth
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade not null,
  full_name text,
  role text default 'member' check (role in ('owner', 'admin', 'member', 'reviewer')),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 3. Ingested security policies & compliance collateral
-- ============================================================
create table if not exists compliance_documents (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade not null,
  title text not null,
  file_path text not null,
  file_type text not null,
  file_size_bytes integer,
  status text default 'processing'
    check (status in ('processing', 'ready', 'failed')),
  error_message text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 4. Document chunks & vector embeddings
-- ============================================================
create table if not exists document_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references compliance_documents(id) on delete cascade not null,
  org_id uuid references organizations(id) on delete cascade not null,
  chunk_index integer not null,
  content text not null,
  token_count integer not null,
  metadata jsonb default '{}'::jsonb not null,
  embedding vector(1536) not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Vector search index for fast cosine similarity queries
create index if not exists idx_chunks_embedding
  on document_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists idx_chunks_org on document_chunks (org_id);
create index if not exists idx_chunks_document on document_chunks (document_id);

-- ============================================================
-- 5. Uploaded questionnaires (spreadsheets / audits)
-- ============================================================
create table if not exists questionnaires (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade not null,
  title text not null,
  source_file_path text not null,
  total_questions integer default 0,
  completed_questions integer default 0,
  status text default 'uploaded'
    check (status in ('uploaded', 'parsing', 'drafting', 'completed', 'failed')),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- ============================================================
-- 6. Individual questionnaire questions & AI drafts
-- ============================================================
create table if not exists questionnaire_items (
  id uuid primary key default uuid_generate_v4(),
  questionnaire_id uuid references questionnaires(id) on delete cascade not null,
  org_id uuid references organizations(id) on delete cascade not null,
  sheet_name text not null,
  row_index integer not null,
  question_text text not null,
  section_category text,
  suggested_answer text,
  human_approved_answer text,
  confidence_score numeric(4, 3),
  review_status text default 'pending'
    check (review_status in ('pending', 'approved', 'edited', 'flagged')),
  citation_chunk_ids uuid[] default array[]::uuid[],
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_items_questionnaire
  on questionnaire_items (questionnaire_id);
create index if not exists idx_items_status
  on questionnaire_items (questionnaire_id, review_status);

-- ============================================================
-- Row-Level Security: tenant isolation everywhere
-- ============================================================
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table compliance_documents enable row level security;
alter table document_chunks enable row level security;
alter table questionnaires enable row level security;
alter table questionnaire_items enable row level security;

-- Helper: current user's organization ID
create or replace function get_current_user_org()
returns uuid
language sql
stable
as $$
  select org_id from profiles where id = auth.uid()
$$;

-- Organizations & profiles
create policy "Read own organization"
  on organizations for select
  using (id = get_current_user_org());

create policy "Read own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Update own profile"
  on profiles for update
  using (id = auth.uid());

-- Tenant isolation for domain tables
create policy "Tenant isolation for compliance_documents"
  on compliance_documents for all
  using (org_id = get_current_user_org())
  with check (org_id = get_current_user_org());

create policy "Tenant isolation for document_chunks"
  on document_chunks for all
  using (org_id = get_current_user_org())
  with check (org_id = get_current_user_org());

create policy "Tenant isolation for questionnaires"
  on questionnaires for all
  using (org_id = get_current_user_org())
  with check (org_id = get_current_user_org());

create policy "Tenant isolation for questionnaire_items"
  on questionnaire_items for all
  using (org_id = get_current_user_org())
  with check (org_id = get_current_user_org());
