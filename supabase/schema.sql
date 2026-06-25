-- ============================================================
-- Manager Dashboard — Supabase schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1) Profiles: one row per logged-in user, holds their role.
--    The 'role' column is just a display label (Manager / Boss) — it does NOT
--    restrict editing. Access is controlled by the allow-list below.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'boss' check (role in ('manager','boss')),
  created_at timestamptz default now()
);

-- 2) Workspace: a single shared document holding all the app data.
create table if not exists public.workspaces (
  id         text primary key default 'default',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 2.5) ACCESS CONTROL — invite-only.
-- Only emails on this allow-list may sign up or touch data. The table itself is
-- locked: RLS is on with NO policy, so no client (anon or authenticated) can read
-- or write it via the API — only the SECURITY DEFINER code below can see it.
create table if not exists public.allowed_emails (
  email    text primary key,
  added_at timestamptz default now()
);
alter table public.allowed_emails enable row level security;
revoke all on public.allowed_emails from anon, authenticated;

-- >>> EDIT THIS LIST to add or remove who is allowed in <<<
insert into public.allowed_emails (email) values
  ('ali@cognivise.co.uk'),
  ('aliarzvi@gmail.com'),
  ('amir@chromeclouds.co.uk')
on conflict (email) do nothing;

-- Helper: is the current caller's email on the allow-list?
-- Lives in a PRIVATE schema so it is NOT exposed as a REST RPC endpoint;
-- RLS policies can still call it, PostgREST cannot.
create schema if not exists private;
create or replace function private.is_allowed()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
$$;
revoke all on function private.is_allowed() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_allowed() to authenticated;

-- 3) Row Level Security
alter table public.profiles  enable row level security;
alter table public.workspaces enable row level security;

-- profiles: only allow-listed users can read; users can create their own row
drop policy if exists "profiles_read"   on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_read"   on public.profiles for select to authenticated using ( private.is_allowed() );
-- wrap auth.uid() in a subselect so it's evaluated once per query, not once per row (perf)
create policy "profiles_insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);

-- workspaces: allow-listed signed-in users can READ and WRITE (manager AND boss).
-- A FOR ALL policy already covers SELECT, so one policy is enough.
drop policy if exists "ws_read"    on public.workspaces;
drop policy if exists "ws_write"   on public.workspaces;
drop policy if exists "ws_allowed" on public.workspaces;
create policy "ws_allowed" on public.workspaces for all to authenticated
  using ( private.is_allowed() ) with check ( private.is_allowed() );

-- 4) Auto-create a profile on signup — and BLOCK sign-ups whose email isn't allow-listed.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.allowed_emails where lower(email) = lower(new.email)
  ) then
    raise exception 'This email is not authorised to sign up. Contact the administrator.';
  end if;
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'boss')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) Create the single workspace row.
insert into public.workspaces (id, data) values ('default', '{}'::jsonb)
on conflict (id) do nothing;

-- 6) Realtime: let clients receive live updates of the workspace.
alter publication supabase_realtime add table public.workspaces;

-- ============================================================
-- MANAGING ACCESS
-- Add someone (must be done BEFORE they sign up):
--   insert into public.allowed_emails (email) values ('newperson@example.com');
-- Remove someone's future access (also delete their account in Auth → Users):
--   delete from public.allowed_emails where email = 'someone@example.com';
-- Label yourself as manager (cosmetic only):
--   update public.profiles set role = 'manager' where email = 'ali@cognivise.co.uk';
-- ============================================================
