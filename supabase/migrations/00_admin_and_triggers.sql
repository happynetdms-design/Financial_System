-- Happynet hardening, onboarding, profiles, audit, and super-admin controls.
-- Apply after the core schema migrations.

-- Extend the existing role enum without replacing it.
do $$ begin
  alter type public.user_role add value if not exists 'super_admin';
exception when duplicate_object then null; end $$;

alter table public.user_profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists job_title text,
  add column if not exists department text,
  add column if not exists preferences jsonb not null default '{"notifications":true,"weekly_summary":true,"theme":"system"}'::jsonb;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  branch_id uuid references public.branches(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_user_action on public.audit_logs(user_id, action);
create index if not exists idx_audit_logs_branch on public.audit_logs(branch_id);

-- A security-definer trigger creates the first assignment at registration time.
-- It creates the main company/branch only when a deployment has not seeded one.
create or replace function public.hfms_on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_branch_id uuid;
begin
  select id into v_branch_id from public.branches where code = 'main' order by created_at limit 1;
  if v_branch_id is null then
    select id into v_company_id from public.companies order by created_at limit 1;
    if v_company_id is null then
      insert into public.companies(name) values ('Happynet') returning id into v_company_id;
    end if;
    insert into public.branches(company_id, name, code)
      values (v_company_id, 'Main', 'main')
      on conflict (company_id, code) do update set code = excluded.code
      returning id into v_branch_id;
    if v_branch_id is null then
      select id into v_branch_id from public.branches where company_id = v_company_id and code = 'main';
    end if;
  end if;

  insert into public.user_profiles(user_id, first_name, last_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'first_name',''), coalesce(new.raw_user_meta_data->>'last_name',''))
    on conflict (user_id) do nothing;
  insert into public.user_branch_access(user_id, branch_id, role, granted_by)
    values (new.id, v_branch_id, 'viewer', null)
    on conflict (user_id, branch_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_hfms_on_auth_user_created on auth.users;
create trigger trg_hfms_on_auth_user_created
after insert on auth.users
for each row execute function public.hfms_on_auth_user_created();

-- Repair accounts created before this migration was applied.
do $$
declare
  v_user record;
  v_branch_id uuid;
begin
  select id into v_branch_id from public.branches where code = 'main' order by created_at limit 1;
  if v_branch_id is not null then
    for v_user in select id, raw_user_meta_data from auth.users loop
      insert into public.user_profiles(user_id, first_name, last_name)
        values (v_user.id, coalesce(v_user.raw_user_meta_data->>'first_name',''), coalesce(v_user.raw_user_meta_data->>'last_name',''))
        on conflict (user_id) do nothing;
      insert into public.user_branch_access(user_id, branch_id, role)
        values (v_user.id, v_branch_id, 'viewer')
        on conflict (user_id, branch_id) do nothing;
    end loop;
  end if;
end;
$$;

alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_read_super_admin on public.audit_logs;
create policy audit_logs_read_super_admin on public.audit_logs for select to authenticated
using (exists (select 1 from public.user_branch_access uba where uba.user_id = auth.uid() and uba.role = 'super_admin'));
drop policy if exists audit_logs_insert_authenticated on public.audit_logs;
create policy audit_logs_insert_authenticated on public.audit_logs for insert to authenticated
with check (user_id = auth.uid());

alter table public.user_profiles enable row level security;
drop policy if exists user_profiles_self_read on public.user_profiles;
create policy user_profiles_self_read on public.user_profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists user_profiles_self_write on public.user_profiles;
create policy user_profiles_self_write on public.user_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Service-role API writes still pass through these database guards.
create or replace function public.hfms_block_closed_period_record()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  payload jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  record_date date := nullif(payload->>tg_argv[0], '')::date;
  branch uuid := nullif(payload->>'branch_id', '')::uuid;
begin
  if branch is not null and record_date is not null and public.hfms_period_is_closed(branch, record_date) then
    raise exception 'This financial period is closed for the record date.' using errcode = '45000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_hfms_closed_revenue_entry on public.revenue_entries;
create trigger trg_hfms_closed_revenue_entry before insert or update or delete on public.revenue_entries
for each row execute function public.hfms_block_closed_period_record('entry_date');
drop trigger if exists trg_hfms_closed_expense on public.expenses;
create trigger trg_hfms_closed_expense before insert or update or delete on public.expenses
for each row execute function public.hfms_block_closed_period_record('expense_date');
drop trigger if exists trg_hfms_closed_loan_payment on public.loan_payments;
create trigger trg_hfms_closed_loan_payment before insert or update or delete on public.loan_payments
for each row execute function public.hfms_block_closed_period_record('payment_date');

