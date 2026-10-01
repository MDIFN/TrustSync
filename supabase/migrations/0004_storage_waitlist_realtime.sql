-- Storage bucket, waitlist leads table, and realtime replication.

-- ============================================================
-- 1. Private storage bucket for questionnaires & compliance docs
-- ============================================================
insert into storage.buckets (id, name, public)
values ('questionnaire_files', 'questionnaire_files', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('compliance_documents', 'compliance_documents', false)
on conflict (id) do nothing;

-- Tenant-scoped storage access: users may only touch files under their org prefix
create policy "Tenant storage access for questionnaire_files"
  on storage.objects for all
  using (
    bucket_id in ('questionnaire_files', 'compliance_documents')
    and (storage.foldername(name))[1] = (get_current_user_org())::text
  )
  with check (
    bucket_id in ('questionnaire_files', 'compliance_documents')
    and (storage.foldername(name))[1] = (get_current_user_org())::text
  );

-- ============================================================
-- 2. Waitlist leads (public landing page funnel)
-- ============================================================
create table if not exists waitlist_leads (
  id uuid primary key default uuid_generate_v4(),
  work_email text not null,
  company_name text not null,
  company_domain text not null,
  deal_size_tier text check (deal_size_tier in ('under_25k', '25k_to_100k', 'over_100k')),
  current_bottleneck text not null,
  compliance_frameworks text[] default array[]::text[],
  sample_file_url text,
  lead_score integer default 0,
  status text default 'new'
    check (status in ('new', 'contacted', 'pilot_in_progress', 'converted', 'disqualified')),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_waitlist_status on waitlist_leads (status);
create index if not exists idx_waitlist_score on waitlist_leads (lead_score desc);

-- No public RLS policies: leads are written via service-role key only.

-- ============================================================
-- 3. Realtime replication for live review UI
-- ============================================================
alter publication supabase_realtime add table questionnaires;
alter publication supabase_realtime add table questionnaire_items;

-- Broadcast complete row payloads on UPDATE
alter table questionnaires replica identity full;
alter table questionnaire_items replica identity full;
