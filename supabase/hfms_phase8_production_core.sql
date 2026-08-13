-- HFMS Phase 8 Production Core
-- Non-destructive. Run AFTER hfms_phase7_financial_core.sql.

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  movement_date date not null,
  movement_type text not null check (movement_type in ('opening_balance','revenue','expense','owner_loan_funding','owner_loan_repayment','transfer','tax_payment','profit_allocation','other')),
  direction text not null check (direction in ('inflow','outflow')),
  amount_kes numeric(14,2) not null check (amount_kes >= 0),
  from_account_id uuid references public.financial_accounts(id),
  to_account_id uuid references public.financial_accounts(id),
  financial_transaction_id uuid references public.financial_transactions(id) on delete set null,
  source_ref text,
  description text,
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  is_deleted boolean not null default false
);
create index if not exists idx_cash_movements_branch_date on public.cash_movements(branch_id, movement_date);

create table if not exists public.cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  account_id uuid not null references public.financial_accounts(id),
  reconciliation_date date not null,
  system_balance_kes numeric(14,2) not null default 0,
  actual_balance_kes numeric(14,2) not null default 0,
  variance_kes numeric(14,2) generated always as (actual_balance_kes - system_balance_kes) stored,
  status text not null default 'open' check (status in ('open','submitted','approved','rejected')),
  explanation text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(branch_id, account_id, reconciliation_date)
);

create table if not exists public.allocation_approvals (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.allocations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  reason text,
  unique(allocation_id)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  period date not null,
  category_id uuid references public.categories(id),
  budget_kes numeric(14,2) not null check (budget_kes >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id, period, category_id)
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  category_id uuid references public.categories(id),
  description text not null,
  amount_kes numeric(14,2) not null check (amount_kes >= 0),
  frequency text not null check (frequency in ('weekly','monthly','quarterly','annual')),
  next_due_date date not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_aliases (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  alias text not null,
  unique(branch_id, alias)
);

create index if not exists idx_alerts_open on public.financial_alerts(branch_id, status, severity);

alter table public.cash_movements enable row level security;
alter table public.cash_reconciliations enable row level security;
alter table public.allocation_approvals enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.supplier_aliases enable row level security;

-- Read policies; writes remain server-side through Netlify Functions with explicit RBAC.
drop policy if exists cash_movements_read on public.cash_movements;
create policy cash_movements_read on public.cash_movements for select using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists cash_reconciliations_read on public.cash_reconciliations;
create policy cash_reconciliations_read on public.cash_reconciliations for select using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists allocation_approvals_read on public.allocation_approvals;
create policy allocation_approvals_read on public.allocation_approvals for select using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists budgets_read on public.budgets;
create policy budgets_read on public.budgets for select using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists recurring_expenses_read on public.recurring_expenses;
create policy recurring_expenses_read on public.recurring_expenses for select using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists supplier_aliases_read on public.supplier_aliases;
create policy supplier_aliases_read on public.supplier_aliases for select using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));

create or replace view public.v_hfms_financial_position as
select
  branch_id,
  coalesce(sum(case when transaction_type='revenue' and direction='inflow' then net_amount_kes else 0 end),0) as revenue_kes,
  coalesce(sum(case when transaction_type='expense' and direction='outflow' then net_amount_kes else 0 end),0) as expenses_kes,
  coalesce(sum(case when transaction_type='owner_loan_funding' and direction='inflow' then net_amount_kes else 0 end),0) as owner_loan_funding_kes,
  coalesce(sum(case when transaction_type='owner_loan_repayment' and direction='outflow' then net_amount_kes else 0 end),0) as owner_loan_repayment_kes,
  coalesce(sum(case when direction='inflow' then net_amount_kes else -net_amount_kes end),0) as net_ledger_movement_kes
from public.financial_transactions
where is_deleted=false and classification_status='classified'
group by branch_id;

create or replace view public.v_hfms_monthly_summary as
select branch_id,
       date_trunc('month', transaction_date)::date as period,
       coalesce(sum(case when transaction_type='revenue' and direction='inflow' then net_amount_kes else 0 end),0) revenue_kes,
       coalesce(sum(case when transaction_type='expense' and direction='outflow' then net_amount_kes else 0 end),0) expense_kes,
       coalesce(sum(case when transaction_type='owner_loan_funding' and direction='inflow' then net_amount_kes else 0 end),0) owner_loan_funding_kes,
       coalesce(sum(case when transaction_type='owner_loan_repayment' and direction='outflow' then net_amount_kes else 0 end),0) owner_loan_repayment_kes
from public.financial_transactions
where is_deleted=false and classification_status='classified'
group by branch_id, date_trunc('month', transaction_date)::date;

-- Add explicit audit metadata columns where they do not already exist.
alter table public.financial_transactions add column if not exists change_reason text;
alter table public.financial_transactions add column if not exists source_record_hash text;
create index if not exists idx_ft_source_hash on public.financial_transactions(branch_id, source_system, source_record_hash);

alter table public.loans add column if not exists updated_at timestamptz not null default now();
alter table public.loan_payments add column if not exists is_deleted boolean not null default false;
create index if not exists idx_loan_payments_active on public.loan_payments(loan_id,is_deleted,payment_date);
