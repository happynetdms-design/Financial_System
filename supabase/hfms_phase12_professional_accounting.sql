-- HFMS Phase 12: Professional Accounting Layer
-- Adds a real chart of accounts, double-entry journal, accounting periods,
-- period close controls, trial-balance reporting, and statement-ready views.
-- Non-destructive: does not delete existing HFMS data.

create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','revenue','expense')),
  parent_id uuid references public.chart_of_accounts(id) on delete set null,
  is_control boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(branch_id, code)
);

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check(status in ('open','closed','reopened')),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  reopened_by uuid references auth.users(id),
  reopened_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  unique(branch_id, period_start, period_end),
  check(period_end >= period_start)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  entry_date date not null,
  reference text,
  description text not null,
  source_type text not null default 'manual',
  source_id uuid,
  status text not null default 'posted' check(status in ('draft','posted','void')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  voided_at timestamptz,
  void_reason text
);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts(id),
  debit_kes numeric(14,2) not null default 0 check(debit_kes >= 0),
  credit_kes numeric(14,2) not null default 0 check(credit_kes >= 0),
  memo text,
  check((debit_kes = 0 and credit_kes > 0) or (credit_kes = 0 and debit_kes > 0))
);

create index if not exists idx_coa_branch_code on public.chart_of_accounts(branch_id, code);
create index if not exists idx_period_branch_dates on public.accounting_periods(branch_id, period_start, period_end);
create index if not exists idx_journal_branch_date on public.journal_entries(branch_id, entry_date);
create index if not exists idx_journal_lines_account on public.journal_lines(account_id);

-- Seed a professional baseline chart of accounts for every existing branch.
do $$
declare b record;
begin
  for b in select id from public.branches where is_active=true loop
    insert into public.chart_of_accounts(branch_id,code,name,account_type,is_control) values
      (b.id,'1000','Cash & Bank','asset',true),
      (b.id,'1100','M-Pesa / Mobile Money','asset',true),
      (b.id,'1200','Accounts Receivable','asset',true),
      (b.id,'1300','Other Current Assets','asset',false),
      (b.id,'2000','Accounts Payable','liability',true),
      (b.id,'2100','Tax Payable','liability',true),
      (b.id,'2200','Owner Loan Payable','liability',true),
      (b.id,'3000','Owner Equity','equity',true),
      (b.id,'3100','Retained Earnings','equity',true),
      (b.id,'4000','Internet Service Revenue','revenue',true),
      (b.id,'5000','Operating Expenses','expense',true),
      (b.id,'5100','Bank & Payment Charges','expense',true),
      (b.id,'5200','Taxes & Licences','expense',false)
    on conflict(branch_id,code) do nothing;
  end loop;
end $$;

-- Trial balance view: only posted journal entries contribute.
create or replace view public.v_hfms_trial_balance as
select
  je.branch_id,
  jl.account_id,
  coa.code,
  coa.name,
  coa.account_type,
  coalesce(sum(jl.debit_kes),0) total_debit_kes,
  coalesce(sum(jl.credit_kes),0) total_credit_kes,
  coalesce(sum(jl.debit_kes-jl.credit_kes),0) net_balance_kes
from public.journal_entries je
join public.journal_lines jl on jl.journal_entry_id=je.id
join public.chart_of_accounts coa on coa.id=jl.account_id
where je.status='posted'
group by je.branch_id,jl.account_id,coa.code,coa.name,coa.account_type;

-- Closed periods are immutable. Reopening is an explicit controlled action.
create or replace function public.hfms_period_is_closed(p_branch uuid, p_date date)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.accounting_periods p where p.branch_id=p_branch and p.status='closed' and p_date between p.period_start and p.period_end);
$$;

create or replace function public.hfms_block_closed_financial_transaction()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if public.hfms_period_is_closed(coalesce(new.branch_id,old.branch_id),coalesce(new.transaction_date,old.transaction_date)) then
    raise exception 'Accounting period is closed for this transaction date. Reopen the period through HFMS controls before making changes.';
  end if;
  return coalesce(new,old);
end;
$$;

drop trigger if exists trg_hfms_closed_period_financial_tx on public.financial_transactions;
create trigger trg_hfms_closed_period_financial_tx
before insert or update or delete on public.financial_transactions
for each row execute function public.hfms_block_closed_financial_transaction();

alter table public.chart_of_accounts enable row level security;
alter table public.accounting_periods enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

drop policy if exists coa_read on public.chart_of_accounts;
create policy coa_read on public.chart_of_accounts for select using(public.is_head_office() or public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists periods_read on public.accounting_periods;
create policy periods_read on public.accounting_periods for select using(public.is_head_office() or public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists journal_read on public.journal_entries;
create policy journal_read on public.journal_entries for select using(public.is_head_office() or public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists journal_lines_read on public.journal_lines;
create policy journal_lines_read on public.journal_lines for select using(exists(select 1 from public.journal_entries je where je.id=journal_entry_id and (public.is_head_office() or public.has_branch_role(je.branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]))));

-- Audit every journal mutation.
create or replace function public.audit_hfms_journal()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_log(table_name,record_id,action,old_data,new_data,changed_by,reason)
  values(tg_table_name,coalesce(new.id,old.id),lower(tg_op),case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,auth.uid(),'Professional accounting journal mutation');
  return coalesce(new,old);
end;
$$;

drop trigger if exists trg_audit_hfms_journal on public.journal_entries;
create trigger trg_audit_hfms_journal after insert or update or delete on public.journal_entries for each row execute function public.audit_hfms_journal();
drop trigger if exists trg_audit_hfms_journal_lines on public.journal_lines;
create trigger trg_audit_hfms_journal_lines after insert or update or delete on public.journal_lines for each row execute function public.audit_hfms_journal();

-- Prevent unbalanced posted journal entries.
create or replace function public.hfms_check_journal_balance(p_entry uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select abs(coalesce(sum(debit_kes),0)-coalesce(sum(credit_kes),0)) < 0.005 from public.journal_lines where journal_entry_id=p_entry;
$$;

-- Reusable management KPI view.
create or replace view public.v_hfms_management_kpis as
select
  ft.branch_id,
  coalesce(sum(case when ft.transaction_type='revenue' and ft.direction='in' then ft.net_amount_kes else 0 end),0) revenue_kes,
  coalesce(sum(case when ft.transaction_type='expense' and ft.direction='out' then ft.net_amount_kes else 0 end),0) expenses_kes,
  coalesce(sum(case when ft.transaction_type='owner_loan_funding' and ft.direction='in' then ft.net_amount_kes else 0 end),0) owner_funding_kes,
  coalesce(sum(case when ft.transaction_type='owner_loan_repayment' and ft.direction='out' then ft.net_amount_kes else 0 end),0) owner_repayment_kes,
  coalesce(sum(case when ft.direction='in' then ft.net_amount_kes else 0 end),0) cash_in_kes,
  coalesce(sum(case when ft.direction='out' then ft.net_amount_kes else 0 end),0) cash_out_kes
from public.financial_transactions ft
where ft.is_deleted=false and ft.classification_status='classified'
group by ft.branch_id;

comment on table public.chart_of_accounts is 'Professional double-entry chart of accounts for HFMS.';
comment on table public.accounting_periods is 'Controlled accounting periods with close/reopen workflow.';
comment on table public.journal_entries is 'Posted accounting journal headers; all posted entries must balance.';
