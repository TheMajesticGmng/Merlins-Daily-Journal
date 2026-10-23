-- Run in the Supabase SQL Editor. User data is protected by PostgreSQL Row Level Security.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  pet_name text not null default 'Merlin',
  pet_weight_lbs numeric(6,2),
  updated_at timestamptz not null default now(),
  constraint display_name_length check (char_length(display_name) <= 80),
  constraint pet_name_length check (char_length(pet_name) <= 80),
  constraint weight_sane check (pet_weight_lbs is null or (pet_weight_lbs > 0 and pet_weight_lbs < 400))
);

create table if not exists public.day_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  day_date date not null,
  record jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, day_date),
  constraint record_object check (jsonb_typeof(record) = 'object'),
  constraint record_size check (pg_column_size(record) < 200000)
);

-- Existing projects can run this schema again to add the per-account default routine.
-- This is public browser configuration only; actual row access remains controlled by RLS.
alter table public.profiles add column if not exists default_schedule jsonb;
alter table public.profiles enable row level security;
alter table public.day_records enable row level security;

-- Explicitly restrict access to authenticated users; a browser publishable/anon key alone cannot read records.
revoke all on public.profiles from anon;
revoke all on public.day_records from anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.day_records to authenticated;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "profiles_delete_self" on public.profiles;
create policy "profiles_delete_self" on public.profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "days_select_self" on public.day_records;
create policy "days_select_self" on public.day_records for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "days_insert_self" on public.day_records;
create policy "days_insert_self" on public.day_records for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "days_update_self" on public.day_records;
create policy "days_update_self" on public.day_records for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "days_delete_self" on public.day_records;
create policy "days_delete_self" on public.day_records for delete to authenticated
  using ((select auth.uid()) = user_id);
