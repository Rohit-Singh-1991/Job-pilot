-- InterviewMate storage schema snapshot.
-- Applied to Supabase project jkizlwysrsvbpnhddrfa as migration interviewmate_persistent_storage.
-- Keep in sync with Supabase migration history; do not re-run against production without review.

create table if not exists public.interviewmate_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  target_tracks text[] not null default array['javaAngular','leadAngular']::text[],
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interviewmate_profiles_tracks_check check (target_tracks <@ array['javaAngular','leadAngular']::text[])
);

create table if not exists public.interviewmate_resume_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track text not null check (track in ('javaAngular','leadAngular')),
  asset_kind text not null default 'master_resume' check (asset_kind in ('master_resume','photo','tailored_resume')),
  object_path text not null,
  original_filename text not null default '',
  content_type text not null default 'application/octet-stream',
  file_size_bytes bigint not null default 0 check (file_size_bytes >= 0 and file_size_bytes <= 15728640),
  extracted_text text,
  created_at timestamptz not null default now(),
  unique (user_id, object_path)
);

create table if not exists public.interviewmate_jobs (
  id uuid primary key default gen_random_uuid(),
  track text not null check (track in ('javaAngular','leadAngular')),
  source text not null,
  external_id text not null,
  title text not null,
  company text not null default 'Company not listed',
  location text not null default 'Remote — eligibility not specified',
  original_url text not null,
  description text not null default '',
  salary text not null default '',
  published_at timestamptz,
  match_score integer not null default 0 check (match_score between 0 and 100),
  source_metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (track, source, external_id),
  constraint interviewmate_jobs_http_url check (original_url ~ '^https?://')
);

create table if not exists public.interviewmate_saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.interviewmate_jobs(id) on delete cascade,
  status text not null default 'saved' check (status in ('saved','reviewing','applied','interviewing','offer','rejected','withdrawn')),
  notes text not null default '',
  follow_up_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table if not exists public.interviewmate_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.interviewmate_jobs(id) on delete set null,
  company text not null default '',
  job_title text not null default '',
  job_url text not null default '',
  status text not null default 'saved' check (status in ('saved','preparing','ready_to_submit','applied','interviewing','offer','rejected','withdrawn')),
  applied_at timestamptz,
  follow_up_at timestamptz,
  recruiter_email text not null default '',
  notes text not null default '',
  confirmation_reference text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interviewmate_applications_url_check check (job_url = '' or job_url ~ '^https?://')
);

create table if not exists public.interviewmate_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  target_email text not null default '',
  tracks text[] not null default array['javaAngular','leadAngular']::text[],
  minimum_score integer not null default 6 check (minimum_score between 0 and 100),
  frequency text not null default 'daily' check (frequency in ('instant','daily','weekly')),
  last_sent_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint interviewmate_notification_tracks_check check (tracks <@ array['javaAngular','leadAngular']::text[])
);

create index if not exists interviewmate_jobs_track_published_idx on public.interviewmate_jobs (track, published_at desc);
create index if not exists interviewmate_saved_jobs_user_status_idx on public.interviewmate_saved_jobs (user_id, status, updated_at desc);
create index if not exists interviewmate_applications_user_followup_idx on public.interviewmate_applications (user_id, follow_up_at) where follow_up_at is not null;

alter table public.interviewmate_profiles enable row level security;
alter table public.interviewmate_resume_assets enable row level security;
alter table public.interviewmate_jobs enable row level security;
alter table public.interviewmate_saved_jobs enable row level security;
alter table public.interviewmate_applications enable row level security;
alter table public.interviewmate_notification_preferences enable row level security;

drop policy if exists "InterviewMate users read own profile" on public.interviewmate_profiles;
create policy "InterviewMate users read own profile" on public.interviewmate_profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "InterviewMate users insert own profile" on public.interviewmate_profiles;
create policy "InterviewMate users insert own profile" on public.interviewmate_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "InterviewMate users update own profile" on public.interviewmate_profiles;
create policy "InterviewMate users update own profile" on public.interviewmate_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "InterviewMate users manage own resume metadata" on public.interviewmate_resume_assets;
create policy "InterviewMate users manage own resume metadata" on public.interviewmate_resume_assets for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "InterviewMate authenticated users read job listings" on public.interviewmate_jobs;
create policy "InterviewMate authenticated users read job listings" on public.interviewmate_jobs for select to authenticated using (true);

drop policy if exists "InterviewMate users manage own saved jobs" on public.interviewmate_saved_jobs;
create policy "InterviewMate users manage own saved jobs" on public.interviewmate_saved_jobs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "InterviewMate users manage own applications" on public.interviewmate_applications;
create policy "InterviewMate users manage own applications" on public.interviewmate_applications for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "InterviewMate users manage own notification preferences" on public.interviewmate_notification_preferences;
create policy "InterviewMate users manage own notification preferences" on public.interviewmate_notification_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update on public.interviewmate_profiles to authenticated;
grant select, insert, update, delete on public.interviewmate_resume_assets to authenticated;
grant select on public.interviewmate_jobs to authenticated;
grant select, insert, update, delete on public.interviewmate_saved_jobs to authenticated;
grant select, insert, update, delete on public.interviewmate_applications to authenticated;
grant select, insert, update, delete on public.interviewmate_notification_preferences to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('interviewmate-private', 'interviewmate-private', false, 15728640, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','image/jpeg','image/png','image/webp']::text[])
on conflict (id) do nothing;

drop policy if exists "InterviewMate users read own private files" on storage.objects;
create policy "InterviewMate users read own private files" on storage.objects for select to authenticated using (bucket_id = 'interviewmate-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "InterviewMate users upload own private files" on storage.objects;
create policy "InterviewMate users upload own private files" on storage.objects for insert to authenticated with check (bucket_id = 'interviewmate-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "InterviewMate users update own private files" on storage.objects;
create policy "InterviewMate users update own private files" on storage.objects for update to authenticated using (bucket_id = 'interviewmate-private' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'interviewmate-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "InterviewMate users delete own private files" on storage.objects;
create policy "InterviewMate users delete own private files" on storage.objects for delete to authenticated using (bucket_id = 'interviewmate-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
