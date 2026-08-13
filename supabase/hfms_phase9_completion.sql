-- HFMS Phase 9 Completion / Production Hardening
-- Run AFTER Phase 7 and Phase 8. Additive and non-destructive.

create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id) on delete cascade,
  notification_type text not null,
  channel text not null default 'in_app' check (channel in ('in_app','email','sms')),
  recipient_user_id uuid references auth.users(id) on delete set null,
  subject text,
  message text not null,
  scheduled_for timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued','sent','failed','cancelled')),
  sent_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_notification_queue_due on public.notification_queue(status, scheduled_for);

create table if not exists public.anomaly_rules (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  rule_type text not null check (rule_type in ('expense_amount','supplier_spike','category_spike','revenue_drop','duplicate_similarity')),
  threshold numeric(14,4) not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(branch_id, rule_type)
);

create table if not exists public.anomaly_events (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  transaction_id uuid references public.financial_transactions(id) on delete set null,
  rule_type text not null,
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  score numeric(10,4),
  message text not null,
  status text not null default 'open' check (status in ('open','acknowledged','dismissed')),
  created_at timestamptz not null default now(),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz
);
create index if not exists idx_anomaly_events_branch_status on public.anomaly_events(branch_id,status,created_at desc);

create table if not exists public.supplier_statements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_expenses_kes numeric(14,2) not null default 0,
  transaction_count integer not null default 0,
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id)
);

create table if not exists public.budget_approvals (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason text,
  requested_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  unique(budget_id)
);

create table if not exists public.reconciliation_lines (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references public.cash_reconciliations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  line_date date,
  description text,
  source_ref text,
  expected_amount_kes numeric(14,2) not null default 0,
  actual_amount_kes numeric(14,2) not null default 0,
  variance_kes numeric(14,2) generated always as (actual_amount_kes-expected_amount_kes) stored,
  status text not null default 'unmatched' check(status in ('matched','unmatched','excluded')),
  created_at timestamptz not null default now()
);

-- Add report/audit fields needed for production exports and statement traceability.
alter table public.financial_transactions add column if not exists report_group text;
alter table public.financial_transactions add column if not exists reconciled boolean not null default false;
alter table public.allocation_proofs add column if not exists verified_by uuid references auth.users(id);
alter table public.allocation_proofs add column if not exists verified_at timestamptz;
alter table public.allocation_proofs add column if not exists verification_note text;

-- Management views used by exports and dashboards.
create or replace view public.v_hfms_budget_vs_actual as
select b.branch_id,b.period,b.category_id,b.budget_kes,
       coalesce(sum(case when ft.transaction_type='expense' and ft.direction='outflow' then ft.net_amount_kes else 0 end),0) actual_kes,
       coalesce(sum(case when ft.transaction_type='expense' and ft.direction='outflow' then ft.net_amount_kes else 0 end),0)-b.budget_kes variance_kes
from public.budgets b
left join public.financial_transactions ft
  on ft.branch_id=b.branch_id and ft.category_id=b.category_id and ft.is_deleted=false and ft.classification_status='classified'
  and ft.transaction_date >= b.period and ft.transaction_date < (b.period + interval '1 month')
group by b.branch_id,b.period,b.category_id,b.budget_kes;

create or replace view public.v_hfms_supplier_monthly as
select ft.branch_id, ft.counterparty, date_trunc('month',ft.transaction_date)::date period,
       count(*) transaction_count,
       coalesce(sum(ft.net_amount_kes),0) total_expenses_kes
from public.financial_transactions ft
where ft.transaction_type='expense' and ft.direction='outflow' and ft.is_deleted=false and ft.classification_status='classified'
group by ft.branch_id,ft.counterparty,date_trunc('month',ft.transaction_date)::date;

alter table public.notification_queue enable row level security;
alter table public.anomaly_rules enable row level security;
alter table public.anomaly_events enable row level security;
alter table public.supplier_statements enable row level security;
alter table public.budget_approvals enable row level security;
alter table public.reconciliation_lines enable row level security;

drop policy if exists notification_queue_read on public.notification_queue;
create policy notification_queue_read on public.notification_queue for select using (public.is_head_office() or (branch_id is not null and public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[])));
drop policy if exists anomaly_rules_read on public.anomaly_rules;
create policy anomaly_rules_read on public.anomaly_rules for select using (public.is_head_office() or public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists anomaly_events_read on public.anomaly_events;
create policy anomaly_events_read on public.anomaly_events for select using (public.is_head_office() or public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists supplier_statements_read on public.supplier_statements;
create policy supplier_statements_read on public.supplier_statements for select using (public.is_head_office() or public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists budget_approvals_read on public.budget_approvals;
create policy budget_approvals_read on public.budget_approvals for select using (public.is_head_office() or public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists reconciliation_lines_read on public.reconciliation_lines;
create policy reconciliation_lines_read on public.reconciliation_lines for select using (public.is_head_office() or public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
