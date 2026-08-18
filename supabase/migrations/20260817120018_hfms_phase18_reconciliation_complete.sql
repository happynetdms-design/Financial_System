-- HFMS Phase 18: Complete bank / M-Pesa / cash reconciliation workflow.
-- Additive migration. Run after Phase 17 AI CFO completion.

alter table public.cash_reconciliations add column if not exists account_name text;
alter table public.cash_reconciliations add column if not exists opening_statement_balance numeric(18,2) not null default 0;
alter table public.cash_reconciliations add column if not exists closing_statement_balance numeric(18,2) not null default 0;
alter table public.cash_reconciliations add column if not exists tolerance_kes numeric(18,2) not null default 0.01;
alter table public.cash_reconciliations add column if not exists statement_source text not null default 'manual';
alter table public.cash_reconciliations add column if not exists statement_file_name text;
alter table public.cash_reconciliations add column if not exists submitted_by uuid references auth.users(id);
alter table public.cash_reconciliations add column if not exists submitted_at timestamptz;
alter table public.cash_reconciliations add column if not exists rejected_by uuid references auth.users(id);
alter table public.cash_reconciliations add column if not exists rejected_at timestamptz;
alter table public.cash_reconciliations add column if not exists rejection_reason text;
alter table public.cash_reconciliations add column if not exists locked_at timestamptz;
alter table public.cash_reconciliations add column if not exists locked_by uuid references auth.users(id);

alter table public.reconciliation_import_rows add column if not exists source_row_number integer;
alter table public.reconciliation_import_rows add column if not exists external_balance numeric(18,2);
alter table public.reconciliation_import_rows add column if not exists source_hash text;
alter table public.reconciliation_import_rows add column if not exists candidate_transaction_id uuid references public.financial_transactions(id);
alter table public.reconciliation_import_rows add column if not exists reviewed_by uuid references auth.users(id);
alter table public.reconciliation_import_rows add column if not exists reviewed_at timestamptz;
alter table public.reconciliation_import_rows add column if not exists review_reason text;
alter table public.reconciliation_import_rows add column if not exists excluded_reason text;

create unique index if not exists uq_recon_statement_row_hash on public.reconciliation_import_rows(reconciliation_id, source_hash) where source_hash is not null;
create index if not exists idx_recon_rows_candidate on public.reconciliation_import_rows(candidate_transaction_id);

create table if not exists public.reconciliation_exceptions (
 id uuid primary key default gen_random_uuid(),
 reconciliation_id uuid not null references public.cash_reconciliations(id) on delete cascade,
 import_row_id uuid references public.reconciliation_import_rows(id) on delete cascade,
 exception_type text not null check(exception_type in ('unmatched_statement','unmatched_ledger','amount_difference','duplicate_statement','duplicate_ledger','invalid_row','timing_difference','other')),
 severity text not null default 'warning' check(severity in ('info','warning','critical')),
 amount_kes numeric(18,2) not null default 0,
 description text not null,
 status text not null default 'open' check(status in ('open','resolved','waived')),
 resolution text,
 resolved_by uuid references auth.users(id),
 resolved_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists idx_recon_exceptions_recon_status on public.reconciliation_exceptions(reconciliation_id,status);

create table if not exists public.reconciliation_audit_events (
 id uuid primary key default gen_random_uuid(),
 reconciliation_id uuid not null references public.cash_reconciliations(id) on delete cascade,
 event_type text not null,
 event_data jsonb not null default '{}'::jsonb,
 actor_id uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists idx_recon_audit_recon_time on public.reconciliation_audit_events(reconciliation_id,created_at desc);

alter table public.reconciliation_exceptions enable row level security;
alter table public.reconciliation_audit_events enable row level security;

drop policy if exists recon_exceptions_read on public.reconciliation_exceptions;
create policy recon_exceptions_read on public.reconciliation_exceptions for select using(public.is_head_office() or exists(select 1 from public.cash_reconciliations r where r.id=reconciliation_id and public.has_branch_role(r.branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[])));
drop policy if exists recon_audit_read on public.reconciliation_audit_events;
create policy recon_audit_read on public.reconciliation_audit_events for select using(public.is_head_office() or exists(select 1 from public.cash_reconciliations r where r.id=reconciliation_id and public.has_branch_role(r.branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[])));

create or replace function public.hfms_reconciliation_locked_guard()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status='approved' or old.locked_at is not null then
    if new.status <> old.status or new.locked_at is distinct from old.locked_at then
      raise exception 'Approved reconciliation is locked and cannot be modified.';
    end if;
    if row_to_json(new)::text <> row_to_json(old)::text then
      raise exception 'Approved reconciliation is locked and cannot be modified.';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_hfms_reconciliation_locked_guard on public.cash_reconciliations;
create trigger trg_hfms_reconciliation_locked_guard before update on public.cash_reconciliations for each row execute function public.hfms_reconciliation_locked_guard();

create or replace function public.hfms_reconciliation_approve_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare open_ex integer;
        variance numeric;
begin
 if new.status='approved' and old.status <> 'approved' then
   select count(*) into open_ex from public.reconciliation_exceptions where reconciliation_id=new.id and status='open';
   variance := abs(coalesce(new.difference,0));
   if variance > coalesce(new.tolerance_kes,0.01) then raise exception 'Reconciliation cannot be approved: statement variance exceeds tolerance.'; end if;
   if open_ex > 0 then raise exception 'Reconciliation cannot be approved: open exceptions remain.'; end if;
   new.approved_at := coalesce(new.approved_at,now());
   new.locked_at := coalesce(new.locked_at,now());
 end if;
 return new;
end; $$;
drop trigger if exists trg_hfms_reconciliation_approve_guard on public.cash_reconciliations;
create trigger trg_hfms_reconciliation_approve_guard before update on public.cash_reconciliations for each row execute function public.hfms_reconciliation_approve_guard();

comment on table public.reconciliation_exceptions is 'Reconciliation exception register requiring resolution or waiver before approval.';
comment on table public.reconciliation_audit_events is 'Immutable reconciliation lifecycle and matching audit events.';
comment on column public.cash_reconciliations.locked_at is 'Set when reconciliation is approved; approved reconciliations are immutable.';
