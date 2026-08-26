-- HFMS Phase 7: Financial Source-of-Truth & Reconciliation
-- Non-destructive migration. Run AFTER hfms_schema_v2.sql.
-- It does not delete or rewrite existing financial records.

create table if not exists public.financial_import_batches (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  source_system text not null check (source_system in ('tende','organization_utility','manual','api')),
  file_name text,
  imported_by uuid references auth.users(id),
  imported_at timestamptz not null default now(),
  rows_received integer not null default 0,
  rows_created integer not null default 0,
  rows_skipped integer not null default 0,
  rows_review integer not null default 0,
  status text not null default 'completed',
  notes text
);

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  transaction_date date not null,
  transaction_type text not null check (transaction_type in
    ('revenue','expense','owner_loan_funding','owner_loan_repayment','transfer','tax','profit_allocation','other_inflow','other_outflow')),
  direction text not null check (direction in ('inflow','outflow')),
  gross_amount_kes numeric(14,2) not null check (gross_amount_kes >= 0),
  charges_kes numeric(14,2) not null default 0 check (charges_kes >= 0),
  net_amount_kes numeric(14,2) not null,
  account_id uuid references public.financial_accounts(id),
  category_id uuid references public.categories(id),
  loan_id uuid references public.loans(id),
  revenue_entry_id uuid references public.revenue_entries(id),
  expense_id uuid references public.expenses(id),
  import_batch_id uuid references public.financial_import_batches(id),
  source_system text not null,
  source_ref text not null,
  external_ref text,
  counterparty text,
  description text,
  classification_status text not null default 'classified'
    check (classification_status in ('classified','review','excluded')),
  source_status text,
  raw_data jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  unique(branch_id, source_system, source_ref)
);

create index if not exists idx_ft_branch_date on public.financial_transactions(branch_id, transaction_date);
create index if not exists idx_ft_type_date on public.financial_transactions(branch_id, transaction_type, transaction_date);
create index if not exists idx_ft_classification on public.financial_transactions(branch_id, classification_status);

create table if not exists public.allocation_proofs (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  allocation_id uuid references public.allocations(id) on delete set null,
  account_id uuid references public.financial_accounts(id),
  expected_amount_kes numeric(14,2) not null default 0,
  actual_amount_kes numeric(14,2) not null default 0,
  proof_reference text,
  proof_date date,
  proof_status text not null default 'pending'
    check (proof_status in ('pending','verified','rejected')),
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.financial_alerts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  alert_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  title text not null,
  message text not null,
  metric_value numeric(14,2),
  threshold_value numeric(14,2),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  created_at timestamptz not null default now(),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz
);

alter table public.financial_import_batches enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.allocation_proofs enable row level security;
alter table public.financial_alerts enable row level security;

drop policy if exists financial_import_batches_read on public.financial_import_batches;
create policy financial_import_batches_read on public.financial_import_batches for select
using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));

drop policy if exists financial_transactions_read on public.financial_transactions;
create policy financial_transactions_read on public.financial_transactions for select
using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));

drop policy if exists allocation_proofs_read on public.allocation_proofs;
create policy allocation_proofs_read on public.allocation_proofs for select
using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));

drop policy if exists financial_alerts_read on public.financial_alerts;
create policy financial_alerts_read on public.financial_alerts for select
using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));

create or replace function public.audit_financial_transaction()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.audit_log(table_name, record_id, action, new_data, changed_by, reason)
    values (tg_table_name, new.id, 'insert', to_jsonb(new), auth.uid(), 'Financial source import / ledger creation');
    return new;
  elsif tg_op='UPDATE' then
    insert into public.audit_log(table_name, record_id, action, old_data, new_data, changed_by, reason)
    values (tg_table_name, new.id, 'update', to_jsonb(old), to_jsonb(new), auth.uid(), 'Financial ledger update');
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_financial_transactions on public.financial_transactions;
create trigger trg_audit_financial_transactions
after insert or update on public.financial_transactions
for each row execute function public.audit_financial_transaction();

-- Convenience reporting view. This is read-only and uses the unified ledger.
create or replace view public.v_financial_daily_summary as
select
  branch_id,
  transaction_date,
  coalesce(sum(case when transaction_type='revenue' and direction='inflow' then net_amount_kes else 0 end),0) revenue_kes,
  coalesce(sum(case when transaction_type='expense' and direction='outflow' then net_amount_kes else 0 end),0) expense_kes,
  coalesce(sum(case when transaction_type='owner_loan_funding' and direction='inflow' then net_amount_kes else 0 end),0) owner_loan_funding_kes,
  coalesce(sum(case when direction='inflow' then net_amount_kes else 0 end),0) total_inflows_kes,
  coalesce(sum(case when direction='outflow' then net_amount_kes else 0 end),0) total_outflows_kes
from public.financial_transactions
where is_deleted=false
group by branch_id, transaction_date;
