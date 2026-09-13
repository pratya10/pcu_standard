-- Separate from `code` (the 5-digit hospital/facility HCODE), this is the
-- longer PCU-specific registration code some units are also identified by.
alter table public.facilities
  add column if not exists pcu_code text;
