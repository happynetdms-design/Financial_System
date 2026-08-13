-- HFMS Phase 11: final production controls and accounting hardening.
-- Additive/non-destructive. Run after Phase 10.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  canonical_name text not null,
  tax_pin text,
  phone text,
  email text,
  status text not null default 'active' check(status in ('active','inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id, canonical_name)
);

create table if not exists public.supplier_aliases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  unique(supplier_id, alias)
);

create table if not exists public.recurring_expense_runs (
  id uuid primary key default gen_random_uuid(),
  recurring_expense_id uuid not null references public.recurring_expenses(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  run_period date not null,
  financial_transaction_id uuid references public.financial_transactions(id) on delete restrict,
  status text not null default 'posted' check(status in ('posted','skipped','failed','pending_approval')),
  amount_kes numeric(18,2) not null default 0,
  error_message text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(recurring_expense_id, run_period)
);

create table if not exists public.reconciliation_import_rows (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references public.cash_reconciliations(id) on delete cascade,
  external_reference text,
  external_date date,
  external_description text,
  external_amount numeric(18,2) not null default 0,
  external_direction text not null check(external_direction in ('in','out')),
  matched_transaction_id uuid references public.financial_transactions(id) on delete restrict,
  match_score numeric(6,3),
  match_status text not null default 'unmatched' check(match_status in ('matched','unmatched','excluded','manual')),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  event_key text not null,
  channel text not null check(channel in ('in_app','email','sms')),
  recipient text,
  subject text,
  body text not null,
  status text not null default 'queued' check(status in ('queued','sent','failed','skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.ai_financial_insights (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  insight_type text not null,
  classification text not null check(classification in ('FACT','CALCULATION','FORECAST','RECOMMENDATION','RISK')),
  title text not null,
  message text not null,
  evidence jsonb not null default '{}'::jsonb,
  period_start date,
  period_end date,
  created_at timestamptz not null default now()
);

create index if not exists idx_suppliers_branch_name on public.suppliers(branch_id, canonical_name);
create index if not exists idx_supplier_aliases_alias on public.supplier_aliases(lower(alias));
create index if not exists idx_recurring_runs_branch_period on public.recurring_expense_runs(branch_id, run_period desc);
create index if not exists idx_recon_import_rows_recon on public.reconciliation_import_rows(reconciliation_id, match_status);
create index if not exists idx_notification_outbox_status on public.notification_outbox(status, created_at);
create index if not exists idx_ai_insights_branch_created on public.ai_financial_insights(branch_id, created_at desc);

-- A normalized view is the canonical source for all reporting. The Phase 7 importer
-- previously used inflow/outflow; Phase 11 standardizes the direction vocabulary to in/out.
create or replace view public.hfms_daily_financial_position as
select
  branch_id,
  transaction_date,
  coalesce(sum(case when transaction_type='revenue' and direction='in' then net_amount_kes else 0 end),0) revenue_kes,
  coalesce(sum(case when transaction_type='expense' and direction='out' then net_amount_kes else 0 end),0) expenses_kes,
  coalesce(sum(case when transaction_type='owner_loan_funding' and direction='in' then net_amount_kes else 0 end),0) owner_funding_kes,
  coalesce(sum(case when transaction_type='owner_loan_repayment' and direction='out' then net_amount_kes else 0 end),0) owner_repayment_kes,
  coalesce(sum(case when direction='in' then net_amount_kes else -net_amount_kes end),0) net_cash_movement_kes
from public.financial_transactions
where coalesce(is_deleted,false)=false and classification_status='classified'
group by branch_id, transaction_date;

create or replace view public.hfms_branch_executive_position as
select
  b.id branch_id,
  b.name branch_name,
  coalesce(sum(case when ft.transaction_type='revenue' and ft.direction='in' then ft.net_amount_kes else 0 end),0) revenue_kes,
  coalesce(sum(case when ft.transaction_type='expense' and ft.direction='out' then ft.net_amount_kes else 0 end),0) expenses_kes,
  coalesce(sum(case when ft.transaction_type='owner_loan_funding' and ft.direction='in' then ft.net_amount_kes else 0 end),0) owner_funding_kes,
  coalesce(sum(case when ft.transaction_type='owner_loan_repayment' and ft.direction='out' then ft.net_amount_kes else 0 end),0) owner_repayment_kes,
  count(ft.id) transaction_count
from public.branches b
left join public.financial_transactions ft on ft.branch_id=b.id and coalesce(ft.is_deleted,false)=false and coalesce(ft.classification_status,'classified')='classified'
group by b.id,b.name;

alter table public.suppliers enable row level security;
alter table public.supplier_aliases enable row level security;
alter table public.recurring_expense_runs enable row level security;
alter table public.reconciliation_import_rows enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.ai_financial_insights enable row level security;

-- Normalize legacy direction vocabulary in place. Existing records are preserved.
alter table public.financial_transactions drop constraint if exists financial_transactions_direction_check;
update public.financial_transactions set direction='in' where direction='inflow';
update public.financial_transactions set direction='out' where direction='outflow';
alter table public.financial_transactions add constraint financial_transactions_direction_check check (direction in ('in','out'));

alter table public.cash_movements drop constraint if exists cash_movements_direction_check;
update public.cash_movements set direction='in' where direction='inflow';
update public.cash_movements set direction='out' where direction='outflow';
alter table public.cash_movements add constraint cash_movements_direction_check check (direction in ('in','out'));

-- Keep the existing legacy view compatible with the normalized vocabulary.
create or replace view public.v_hfms_financial_position as
select
  branch_id,
  coalesce(sum(case when transaction_type='revenue' and direction='in' then net_amount_kes else 0 end),0) as revenue_kes,
  coalesce(sum(case when transaction_type='expense' and direction='out' then net_amount_kes else 0 end),0) as expenses_kes,
  coalesce(sum(case when transaction_type='owner_loan_funding' and direction='in' then net_amount_kes else 0 end),0) as owner_loan_funding_kes,
  coalesce(sum(case when transaction_type='owner_loan_repayment' and direction='out' then net_amount_kes else 0 end),0) as owner_loan_repayment_kes,
  coalesce(sum(case when direction='in' then net_amount_kes else -net_amount_kes end),0) as net_ledger_movement_kes
from public.financial_transactions
where is_deleted=false and classification_status='classified'
group by branch_id;

-- Policies for the new tables. Server-side writes are still controlled by Netlify RBAC.
drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers for select using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists supplier_aliases_read_v11 on public.supplier_aliases;
create policy supplier_aliases_read_v11 on public.supplier_aliases for select using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists recurring_runs_read on public.recurring_expense_runs;
create policy recurring_runs_read on public.recurring_expense_runs for select using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists reconciliation_import_rows_read on public.reconciliation_import_rows;
create policy reconciliation_import_rows_read on public.reconciliation_import_rows for select using (public.is_head_office() or exists (select 1 from public.cash_reconciliations cr where cr.id=reconciliation_id and (public.is_head_office() or public.has_branch_role(cr.branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]))));
drop policy if exists ai_financial_insights_read on public.ai_financial_insights;
create policy ai_financial_insights_read on public.ai_financial_insights for select using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
