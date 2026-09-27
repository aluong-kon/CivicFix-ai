-- CivicFix AI Database Schema
-- Supabase / PostgreSQL

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  tracking_code text unique,
  reporter_name text,
  reporter_phone text,
  photo_url text,
  video_url text,
  text_description text,
  transcript text,
  location text,
  category text,
  severity_score integer,
  confidence_score float,
  duplicate_of uuid references reports(id),
  model_name text,
  gpu_type text,
  latency_ms integer,
  status text default 'reported',
  created_at timestamp default now()
);

-- Index for fast ordering by severity and duplicate queries
create index if not exists idx_reports_severity on reports(severity_score desc);
create index if not exists idx_reports_tracking on reports(tracking_code);
create index if not exists idx_reports_duplicate on reports(duplicate_of);
