-- ============================================================
--  Inbox scan — run this ONCE in Supabase → SQL Editor
--  Stores the Google refresh token so the scan-email function
--  can mint fresh access tokens whenever you click "Scan".
-- ============================================================

create table if not exists public.email_connections (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  email         text,
  provider      text not null default 'google',
  refresh_token text not null,
  connected_at  timestamptz not null default now()
);

alter table public.email_connections enable row level security;

-- the signed-in client must be GRANTED table privileges (RLS policies alone are not enough).
-- SELECT is granted but there is no SELECT *policy*, so the refresh token still can't be read back.
grant select, insert, update, delete on public.email_connections to authenticated;

-- a user may create/refresh/remove ONLY their own connection…
drop policy if exists ec_insert on public.email_connections;
create policy ec_insert on public.email_connections
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists ec_update on public.email_connections;
create policy ec_update on public.email_connections
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists ec_delete on public.email_connections;
create policy ec_delete on public.email_connections
  for delete to authenticated using (user_id = (select auth.uid()));
-- …and there is NO select policy, so the refresh token can never be read back from the client.

-- "is my inbox connected?" — SECURITY DEFINER so it can read the locked table
create or replace function public.has_email_connection()
returns boolean language sql security definer set search_path = public stable as $$
  select exists(select 1 from public.email_connections where user_id = auth.uid());
$$;
revoke all on function public.has_email_connection() from anon;
grant execute on function public.has_email_connection() to authenticated;
