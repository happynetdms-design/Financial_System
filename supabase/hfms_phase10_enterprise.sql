-- HFMS Phase 10: enterprise accounting, reconciliation and reporting layer.
-- Additive/non-destructive. Run after Phase 9 migrations.

create table if not exists public.cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  account_id uuid references public.financial_accounts(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  statement_balance numeric(18,2) not null default 0,
  ledger_balance numeric(18,2) not null default 0,
  difference numeric(18,2) generated always as (statement_balance-ledger_balance) stored,
  status text not null default 'open' check(status in ('open','submitted','approved','rejected')),
  prepared_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references public.cash_reconciliations(id) on delete cascade,
  ledger_transaction_id uuid references public.financial_transactions(id) on delete restrict,
  external_reference text,
  external_date date,
  external_amount numeric(18,2),
  match_status text not null default 'unmatched' check(match_status in ('matched','unmatched','excluded')),
  match_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_statement_snapshots (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  statement_type text not null check(statement_type in ('pnl','cash_flow','balance_sheet','profit_first','management_pack')),
  payload jsonb not null default '{}'::jsonb,
  generated_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  user_id uuid references auth.users(id) on delete cascade,
  event_key text not null,
  in_app boolean not null default true,
  email boolean not null default false,
  sms boolean not null default false,
  threshold numeric(18,2),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(branch_id,user_id,event_key)
);

create index if not exists idx_cash_recon_branch_period on public.cash_reconciliations(branch_id,period_end desc);
create index if not exists idx_recon_matches_recon on public.reconciliation_matches(reconciliation_id);
create index if not exists idx_statement_snapshots_branch_period on public.financial_statement_snapshots(branch_id,period_end desc);
create index if not exists idx_notification_preferences_branch on public.notification_preferences(branch_id,event_key);

create or replace view public.hfms_monthly_financial_statement as
select
  branch_id,
  date_trunc('month', transaction_date)::date as month,
  coalesce(sum(case when transaction_type='revenue' and direction='in' then net_amount_kes else 0 end),0) revenue,
  coalesce(sum(case when transaction_type='expense' and direction='out' then net_amount_kes else 0 end),0) expenses,
  coalesce(sum(case when transaction_type='owner_loan' and direction='in' then net_amount_kes else 0 end),0) owner_loan_funding,
  coalesce(sum(case when transaction_type='owner_loan_repayment' and direction='out' then net_amount_kes else 0 end),0) owner_loan_repayments,
  coalesce(sum(case when direction='in' then net_amount_kes else -net_amount_kes end),0) net_cash_movement
from public.financial_transactions
where coalesce(is_deleted,false)=false and classification_status='classified'
group by branch_id,date_trunc('month',transaction_date)::date;

create or replace view public.hfms_owner_loan_balance as
select branch_id,
       coalesce(sum(case when transaction_type='owner_loan' and direction='in' then net_amount_kes else 0 end),0)
       - coalesce(sum(case when transaction_type='owner_loan_repayment' and direction='out' then net_amount_kes else 0 end),0) as balance
from public.financial_transactions
where coalesce(is_deleted,false)=false and classification_status='classified'
group by branch_id;

alter table public.cash_reconciliations enable row level security;
alter table public.reconciliation_matches enable row level security;
alter table public.financial_statement_snapshots enable row level security;
alter table public.notification_preferences enable row level security;
