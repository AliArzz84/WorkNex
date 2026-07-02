-- ============================================================
-- Employee Invoice Portal — Supabase setup
-- Paste this WHOLE file into: Supabase → SQL Editor → New query → Run.
-- Safe to re-run (idempotent). Run it once; it builds on the existing schema.sql.
-- ============================================================

-- ── 0) Allow a third role: 'employee' (portal users, invoice-only, NO company data)
alter table public.allowed_emails
  add column if not exists role text not null default 'boss';
alter table public.allowed_emails drop constraint if exists allowed_emails_role_check;
alter table public.allowed_emails
  add constraint allowed_emails_role_check check (role in ('manager','boss','employee'));
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('manager','boss','employee'));

-- ── 0.5) CRITICAL: make signup stamp the INVITED role onto the new profile, so an
--     approved employee becomes 'employee' (NOT the default 'boss', which would hand
--     them full company access). Safe to re-run; supersedes the base handle_new_user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare invited_role text;
begin
  select role into invited_role from public.allowed_emails
    where lower(email) = lower(new.email) limit 1;
  if invited_role is null then
    raise exception 'This email is not authorised to sign up. Contact the administrator.';
  end if;
  insert into public.profiles (id, email, role)
    values (new.id, new.email, coalesce(invited_role, 'boss'))
    on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 1) Helper: is the caller a MANAGER/BOSS (i.e. staff, not an employee)?
--     Employees are on the allow-list too, so is_allowed() alone isn't enough to
--     keep them out of the company workspace — we need this stricter check.
create or replace function private.is_manager()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      and role in ('manager','boss')
  );
$$;
revoke all on function private.is_manager() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_manager() to authenticated;

-- ── 2) LOCK the company workspace to managers/boss ONLY.
--     (Before: any allow-listed user could read/write. Employees must NOT.)
drop policy if exists ws_allowed on public.workspaces;
create policy ws_allowed on public.workspaces for all to authenticated
  using ( private.is_manager() ) with check ( private.is_manager() );

-- Tighten profiles: you can read your OWN row; managers can read anyone's.
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated
  using ( (select auth.uid()) = id or private.is_manager() );

-- ── 3) Access requests: an employee asks to join (name + email). Anon can insert;
--     only managers can see / approve / reject.
create table if not exists public.access_requests (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  note       text,
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.access_requests enable row level security;
drop policy if exists ar_insert on public.access_requests;
create policy ar_insert on public.access_requests for insert to anon, authenticated with check (true);
drop policy if exists ar_select on public.access_requests;
create policy ar_select on public.access_requests for select to authenticated using ( private.is_manager() );
drop policy if exists ar_update on public.access_requests;
create policy ar_update on public.access_requests for update to authenticated using ( private.is_manager() ) with check ( private.is_manager() );
drop policy if exists ar_delete on public.access_requests;
create policy ar_delete on public.access_requests for delete to authenticated using ( private.is_manager() );
grant insert on public.access_requests to anon;
grant select, insert, update, delete on public.access_requests to authenticated;

-- ── 4) Approve / reject an access request (managers only).
--     Approving adds the email to the allow-list as an 'employee', so they can
--     then sign up with a password (the existing signup trigger lets them in).
create or replace function public.approve_access_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.access_requests;
begin
  if not private.is_manager() then raise exception 'Not authorised'; end if;
  select * into r from public.access_requests where id = p_id;
  if not found then raise exception 'Request not found'; end if;
  insert into public.allowed_emails (email, role) values (lower(r.email), 'employee')
    on conflict (email) do update set role = case
      when public.allowed_emails.role in ('manager','boss') then public.allowed_emails.role  -- never demote staff
      else 'employee' end;
  update public.access_requests set status = 'approved' where id = p_id;
end; $$;
revoke all on function public.approve_access_request(uuid) from public, anon;
grant execute on function public.approve_access_request(uuid) to authenticated;

create or replace function public.reject_access_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.is_manager() then raise exception 'Not authorised'; end if;
  update public.access_requests set status = 'rejected' where id = p_id;
end; $$;
revoke all on function public.reject_access_request(uuid) from public, anon;
grant execute on function public.reject_access_request(uuid) to authenticated;

-- ── 5) Invoices. Employees insert/see ONLY their own; managers see/manage all.
create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  email        text,
  name         text,                                   -- employee's display name (snapshot)
  amount       numeric not null default 0,
  currency     text not null default 'USD',
  invoice_date date,
  description  text,
  project      text,                                   -- workspace project id, set by a manager (optional)
  attachment   text,                                   -- storage path in the 'invoices' bucket (optional)
  status       text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  created_at   timestamptz not null default now()
);
alter table public.invoices enable row level security;

drop policy if exists inv_select on public.invoices;
create policy inv_select on public.invoices for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_manager() );

drop policy if exists inv_insert on public.invoices;
create policy inv_insert on public.invoices for insert to authenticated
  with check ( user_id = (select auth.uid()) );

-- employees may edit/delete only their OWN still-pending invoices; managers can do anything
drop policy if exists inv_update on public.invoices;
create policy inv_update on public.invoices for update to authenticated
  using ( private.is_manager() or (user_id = (select auth.uid()) and status = 'pending') )
  with check ( private.is_manager() or user_id = (select auth.uid()) );

drop policy if exists inv_delete on public.invoices;
create policy inv_delete on public.invoices for delete to authenticated
  using ( private.is_manager() or (user_id = (select auth.uid()) and status = 'pending') );

grant select, insert, update, delete on public.invoices to authenticated;

-- ── 6) Realtime for both tables (badges + live inbox)
do $$ begin
  begin alter publication supabase_realtime add table public.invoices; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.access_requests; exception when duplicate_object then null; end;
end $$;

-- ── 7) Storage bucket for invoice attachments (PDF / images), PRIVATE.
insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- Employees upload/read only inside their own <uid>/ folder; managers read everything.
drop policy if exists inv_obj_insert on storage.objects;
create policy inv_obj_insert on storage.objects for insert to authenticated
  with check ( bucket_id = 'invoices' and (storage.foldername(name))[1] = (select auth.uid())::text );

drop policy if exists inv_obj_select on storage.objects;
create policy inv_obj_select on storage.objects for select to authenticated
  using ( bucket_id = 'invoices' and ( (storage.foldername(name))[1] = (select auth.uid())::text or private.is_manager() ) );

drop policy if exists inv_obj_delete on storage.objects;
create policy inv_obj_delete on storage.objects for delete to authenticated
  using ( bucket_id = 'invoices' and ( (storage.foldername(name))[1] = (select auth.uid())::text or private.is_manager() ) );

-- ── 8) Invoice v2 fields: invoice number, due date, line items, contact + payment
--     details. Idempotent — safe to run on an existing install.
alter table public.invoices
  add column if not exists invoice_no     text,
  add column if not exists due_date       date,
  add column if not exists items          jsonb,   -- [{ desc, qty, rate }]
  add column if not exists phone          text,
  add column if not exists bank_name      text,
  add column if not exists account_holder text,
  add column if not exists iban           text,
  add column if not exists notes          text;

-- ── 9) Submit an access request THROUGH a guarded function, so the public form can't
--     create duplicates or requests from people who are already in. The anon form can't
--     read allowed_emails / access_requests (correctly), so this SECURITY DEFINER function
--     does the checks and returns only a short status string — no data leaks.
--     Returns: 'ok' | 'already_member' | 'already_requested' | 'invalid'
create or replace function public.request_access(p_name text, p_email text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role  text;
  v_id    uuid;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    return 'invalid';
  end if;

  -- already approved / already staff → no new request; they should just sign in
  select role into v_role from public.allowed_emails where lower(email) = v_email limit 1;
  if v_role is not null then
    return 'already_member';
  end if;

  -- an outstanding (pending) or already-approved request → don't duplicate it
  select id into v_id from public.access_requests
    where lower(email) = v_email and status in ('pending', 'approved')
    order by created_at desc limit 1;
  if v_id is not null then
    -- freshen the name/note on the pending row (handy for the manager), but add no new row
    update public.access_requests
      set name = coalesce(nullif(trim(p_name), ''), name),
          note = coalesce(nullif(trim(p_note), ''), note)
      where id = v_id and status = 'pending';
    return 'already_requested';
  end if;

  insert into public.access_requests (name, email, note)
    values (nullif(trim(p_name), ''), v_email, nullif(trim(p_note), ''));
  return 'ok';
end; $$;
revoke all on function public.request_access(text, text, text) from public;
grant execute on function public.request_access(text, text, text) to anon, authenticated;

-- ============================================================
-- DONE. Notes:
--  • Existing managers/boss keep full access (role manager/boss → is_manager() = true).
--  • New employees get in ONLY after you Approve their request in the app (Invoices tab).
--  • Approve adds them to allowed_emails as 'employee'; then they sign up with a password.
--  • Employees can NEVER read the company workspace — only their own invoices.
-- ============================================================
