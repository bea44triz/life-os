-- Run this in the Supabase SQL editor to enable OFX and XLSX imports.
-- Safe to run multiple times.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'import_file_type' and e.enumlabel = 'ofx'
  ) then
    alter type public.import_file_type add value 'ofx';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'import_file_type' and e.enumlabel = 'xlsx'
  ) then
    alter type public.import_file_type add value 'xlsx';
  end if;
end $$;
