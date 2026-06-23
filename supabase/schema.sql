-- ============================================================
-- Manager Dashboard — Supabase schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1) Profiles: one row per logged-in user, holds their role.
--    New users default to 'boss' (read-only) for safety. Promote yourself to
--    'manager' manually (see bottom of this file).
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

-- 3) Row Level Security
alter table public.profiles  enable row level security;
alter table public.workspaces enable row level security;

-- profiles: any authenticated user can read; users can create their own row
drop policy if exists "profiles_read"   on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_read"   on public.profiles for select to authenticated using (true);
create policy "profiles_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- workspaces: any authenticated (signed-in) user can READ and WRITE.
-- Both the manager and the boss can edit. Data is still private — only
-- signed-in users can touch it.
drop policy if exists "ws_read"  on public.workspaces;
drop policy if exists "ws_write" on public.workspaces;
create policy "ws_read"  on public.workspaces for select to authenticated using (true);
create policy "ws_write" on public.workspaces for all to authenticated using (true) with check (true);

-- 4) Auto-create a profile whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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
-- Both signed-in users (you and your boss) can now read AND edit.
-- The 'role' column is just a label shown in the app; it no longer
-- restricts editing. Optionally label yourself as manager:
--   update public.profiles set role = 'manager' where email = 'aliarzvi@gmail.com';
-- ============================================================
