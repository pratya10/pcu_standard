-- PCU Standard Assessment System — initial schema
-- ระบบประเมินมาตรฐานหน่วยบริการปฐมภูมิ (PCU Standard)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Reference / master data
-- ---------------------------------------------------------------------------

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  code text unique,                       -- รหัสหน่วยบริการ 5 หลัก
  name text not null,                     -- ชื่อหน่วยบริการ
  facility_type text,                     -- รพ.สต. / ศสม. / คลินิกชุมชนอบอุ่น / อื่นๆ
  affiliation text,                       -- สังกัด (เช่น อบจ.)
  district text,
  province text,
  cup_hospital text,                      -- โรงพยาบาลแม่ข่าย (CUP)
  address text,
  contact text,
  created_at timestamptz not null default now()
);

create table public.standard_versions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,              -- e.g. '2571-2573'
  name text not null,                     -- มาตรฐานหน่วยบริการปฐมภูมิ ฉบับก้าวหน้า ปี 2571-2573
  description text,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  standard_version_id uuid not null references public.standard_versions(id) on delete cascade,
  code text not null,                     -- '1' | '2' | '3'
  name_th text not null,
  description text,
  sort_order int not null default 0,
  unique (standard_version_id, code)
);

-- Display-only grouping under a category (e.g. 2.1 การจัดบริการรักษาพยาบาลเบื้องต้น)
create table public.topic_groups (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  code text not null,                     -- '2.1'
  name_th text not null,
  description text,
  sort_order int not null default 0,
  unique (category_id, code)
);

-- Scoreable leaf items (29 in the 2571-2573 draft)
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  topic_group_id uuid references public.topic_groups(id) on delete set null,
  code text not null,                     -- '1.1' | '2.1.1' | ...
  name_th text not null,
  intent_text text,                       -- เจตจำนงการประเมิน
  must_text text,                         -- เกณฑ์ The Must
  score0_text text,
  score1_text text,
  score2_text text,
  content_text text,                      -- เนื้อหาในการประเมิน
  s3_breakdown jsonb,                     -- optional {staff:{0,1,2}, system:{...}, structure:{...}}
  is_optional boolean not null default false,  -- หมวด 2.4 บริการเสริม (ไม่มีบริการ = ไม่หักคะแนน)
  allow_na boolean not null default false,
  sort_order int not null default 0,
  unique (category_id, code)
);

create table public.topic_evidence_items (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------------
-- Assessment rounds & live scoring
-- ---------------------------------------------------------------------------

create table public.assessment_rounds (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete restrict,
  standard_version_id uuid not null references public.standard_versions(id) on delete restrict,
  name text not null,
  survey_date date,
  join_code text unique not null,
  status text not null default 'in_progress' check (status in ('draft','in_progress','completed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.assessment_rounds(id) on delete cascade,
  name text not null,
  role text not null check (role in ('evaluator','viewer','chair')),
  device_key text not null,
  joined_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.assessment_rounds(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  score smallint check (score in (0,1,2)),
  is_na boolean not null default false,
  must_pass boolean,
  comment text,
  evidence_checked jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  unique (round_id, topic_id, participant_id)
);

create index scores_round_topic_idx on public.scores (round_id, topic_id);
create index participants_round_idx on public.participants (round_id);
create index topics_category_idx on public.topics (category_id);
create index topic_groups_category_idx on public.topic_groups (category_id);

-- Aggregated view used for reports / summaries
create view public.topic_score_summary as
select
  s.round_id,
  s.topic_id,
  count(*) filter (where s.is_na = false) as n_scored,
  round(avg(s.score) filter (where s.is_na = false)::numeric, 2) as avg_score,
  count(*) filter (where s.is_na = true) as n_na,
  count(*) filter (where s.must_pass = true) as n_must_pass,
  count(*) filter (where s.must_pass = false) as n_must_fail,
  count(*) as n_total
from public.scores s
group by s.round_id, s.topic_id;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Admin/manager screens use a real Supabase Auth session (authenticated role).
-- Committee members join a round with a short join code from their phones and
-- never sign in, so write access to participants/scores is granted to the
-- anon role but scoped to rounds that are not yet completed.

alter table public.facilities enable row level security;
alter table public.standard_versions enable row level security;
alter table public.categories enable row level security;
alter table public.topic_groups enable row level security;
alter table public.topics enable row level security;
alter table public.topic_evidence_items enable row level security;
alter table public.assessment_rounds enable row level security;
alter table public.participants enable row level security;
alter table public.scores enable row level security;

-- Reference data: readable by anyone, writable by authenticated admins only
create policy "facilities_read" on public.facilities for select using (true);
create policy "facilities_write" on public.facilities for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "standard_versions_read" on public.standard_versions for select using (true);
create policy "standard_versions_write" on public.standard_versions for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "categories_read" on public.categories for select using (true);
create policy "categories_write" on public.categories for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "topic_groups_read" on public.topic_groups for select using (true);
create policy "topic_groups_write" on public.topic_groups for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "topics_read" on public.topics for select using (true);
create policy "topics_write" on public.topics for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "topic_evidence_items_read" on public.topic_evidence_items for select using (true);
create policy "topic_evidence_items_write" on public.topic_evidence_items for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Assessment rounds: anyone can look one up (needed to resolve a join code),
-- only admins can create/edit/close them.
create policy "rounds_read" on public.assessment_rounds for select using (true);
create policy "rounds_insert" on public.assessment_rounds for insert
  with check (auth.role() = 'authenticated');
create policy "rounds_update" on public.assessment_rounds for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "rounds_delete" on public.assessment_rounds for delete
  using (auth.role() = 'authenticated');

-- Participants: open join/read while the round is active; admins can manage any time.
create policy "participants_read" on public.participants for select using (true);
create policy "participants_insert" on public.participants for insert
  with check (
    auth.role() = 'authenticated'
    or exists (
      select 1 from public.assessment_rounds r
      where r.id = round_id and r.status <> 'completed'
    )
  );
create policy "participants_update" on public.participants for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
create policy "participants_delete" on public.participants for delete
  using (auth.role() = 'authenticated');

-- Scores: open read (for the live dashboard); write only while the round is
-- still in progress; admins retain full access.
create policy "scores_read" on public.scores for select using (true);
create policy "scores_insert" on public.scores for insert
  with check (
    auth.role() = 'authenticated'
    or exists (
      select 1 from public.assessment_rounds r
      where r.id = round_id and r.status <> 'completed'
    )
  );
create policy "scores_update" on public.scores for update
  using (
    auth.role() = 'authenticated'
    or exists (
      select 1 from public.assessment_rounds r
      where r.id = round_id and r.status <> 'completed'
    )
  )
  with check (
    auth.role() = 'authenticated'
    or exists (
      select 1 from public.assessment_rounds r
      where r.id = round_id and r.status <> 'completed'
    )
  );
create policy "scores_delete" on public.scores for delete
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.assessment_rounds;
