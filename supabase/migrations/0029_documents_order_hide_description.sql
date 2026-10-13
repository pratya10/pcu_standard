-- Admin-managed ordering, hide/unhide, and a description field for
-- "เอกสารการประเมิน" documents.
alter table pcu_standard.documents
  add column if not exists description text,
  add column if not exists hidden boolean not null default false,
  add column if not exists sort_order integer;

-- Backfill existing rows with an initial order matching upload time, so
-- admin reordering has a stable starting point instead of NULLs.
with ranked as (
  select id, row_number() over (order by created_at) as rn
  from pcu_standard.documents
)
update pcu_standard.documents d
set sort_order = ranked.rn
from ranked
where d.id = ranked.id and d.sort_order is null;

alter table pcu_standard.documents alter column sort_order set default 0;
