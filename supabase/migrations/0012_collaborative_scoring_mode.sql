-- Two scoring principles, chosen once when the round is created:
--   'average'       — every evaluator scores every topic independently (the
--                      existing `scores` table, unchanged); results are
--                      averaged/majority-voted afterwards.
--   'collaborative'  — the whole committee shares ONE answer per topic,
--                      building it together in real time. Overwriting a
--                      value someone already set requires confirmation in
--                      the UI and is recorded in team_score_audit.
alter table public.assessment_rounds
  add column if not exists scoring_mode text not null default 'average'
    check (scoring_mode in ('average', 'collaborative'));

-- The shared answer for a round+topic in collaborative mode. One row per
-- topic (not per participant) — whoever edits it writes into this same row.
create table public.team_scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.assessment_rounds(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  score smallint check (score in (0, 1, 2)),
  is_na boolean not null default false,
  must_pass boolean,
  comment text,
  item_notes jsonb not null default '{}'::jsonb,
  updated_by uuid references public.participants(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (round_id, topic_id)
);
create index team_scores_round_idx on public.team_scores (round_id);

alter table public.team_scores enable row level security;
create policy "team_scores_read" on public.team_scores for select using (true);
create policy "team_scores_insert" on public.team_scores for insert
  with check (
    public.is_admin()
    or exists (select 1 from public.assessment_rounds r where r.id = round_id and r.status <> 'completed')
  );
create policy "team_scores_update" on public.team_scores for update
  using (
    public.is_admin()
    or exists (select 1 from public.assessment_rounds r where r.id = round_id and r.status <> 'completed')
  );

-- Every time someone overwrites a value another person (or their past self)
-- already set — the main score, must-pass, or a checklist item's มี/ไม่มี —
-- a row is kept here so the report can show a change log.
create table public.team_score_audit (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.assessment_rounds(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  item_id uuid references public.topic_score_items(id) on delete set null,
  field text not null check (field in ('score', 'must_pass', 'item_checked')),
  participant_id uuid references public.participants(id) on delete set null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index team_score_audit_round_idx on public.team_score_audit (round_id, topic_id);

alter table public.team_score_audit enable row level security;
create policy "team_score_audit_read" on public.team_score_audit for select using (true);
create policy "team_score_audit_insert" on public.team_score_audit for insert
  with check (
    public.is_admin()
    or exists (select 1 from public.assessment_rounds r where r.id = round_id and r.status <> 'completed')
  );
