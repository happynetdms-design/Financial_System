-- HFMS Phase 14: final accounting workflows, reconciliation controls and Profit First lifecycle.
-- Additive/non-destructive. Run after Phase 13.

alter table public.journal_entries add column if not exists source_type text;
alter table public.journal_entries add column if not exists source_id uuid;
alter table public.journal_entries add column if not exists reversal_of uuid references public.journal_entries(id);
alter table public.journal_entries add column if not exists reversal_reason text;
create index if not exists idx_hfms_journal_source on public.journal_entries(branch_id,source_type,source_id);
create index if not exists idx_hfms_journal_reversal on public.journal_entries(reversal_of);

create table if not exists public.hfms_reconciliation_matches (
 id uuid primary key default gen_random_uuid(),
 reconciliation_id uuid not null references public.cash_reconciliations(id) on delete cascade,
 external_row_id uuid references public.reconciliation_import_rows(id) on delete cascade,
 financial_transaction_id uuid references public.financial_transactions(id),
 match_type text not null default 'manual' check(match_type in ('automatic','manual','partial','adjustment')),
 matched_amount_kes numeric(14,2) not null default 0,
 difference_kes numeric(14,2) not null default 0,
 reason text,
 matched_by uuid references auth.users(id),
 matched_at timestamptz not null default now(),
 unique(external_row_id,financial_transaction_id)
);
create index if not exists idx_hfms_recon_matches_recon on public.hfms_reconciliation_matches(reconciliation_id);
alter table public.hfms_reconciliation_matches enable row level security;
drop policy if exists recon_matches_read on public.hfms_reconciliation_matches;
create policy recon_matches_read on public.hfms_reconciliation_matches for select using(public.is_head_office() or exists(select 1 from public.cash_reconciliations r where r.id=reconciliation_id and public.has_branch_role(r.branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[])));
drop policy if exists recon_matches_write on public.hfms_reconciliation_matches;
create policy recon_matches_write on public.hfms_reconciliation_matches for all using(public.is_head_office() or exists(select 1 from public.cash_reconciliations r where r.id=reconciliation_id and public.has_branch_role(r.branch_id,array['owner','finance_manager','accountant','branch_manager']::public.user_role[]))) with check(public.is_head_office() or exists(select 1 from public.cash_reconciliations r where r.id=reconciliation_id and public.has_branch_role(r.branch_id,array['owner','finance_manager','accountant','branch_manager']::public.user_role[])));

alter table public.allocations add column if not exists transfer_status text not null default 'not_transferred';
alter table public.allocations add column if not exists transferred_amount_kes numeric(14,2) not null default 0;
alter table public.allocations add column if not exists transferred_at timestamptz;
alter table public.allocations add column if not exists transferred_by uuid references auth.users(id);
alter table public.allocations add column if not exists variance_kes numeric(14,2);
alter table public.allocations add column if not exists transfer_reference text;

create table if not exists public.hfms_notification_deliveries (
 id uuid primary key default gen_random_uuid(),
 alert_id uuid references public.financial_alerts(id) on delete cascade,
 branch_id uuid not null references public.branches(id) on delete cascade,
 channel text not null check(channel in ('email','sms','in_app','webhook')),
 recipient text not null,
 status text not null default 'queued' check(status in ('queued','sent','failed','cancelled')),
 provider text,
 provider_message_id text,
 error_message text,
 queued_at timestamptz not null default now(),
 sent_at timestamptz
);
create index if not exists idx_hfms_notification_delivery_status on public.hfms_notification_deliveries(status,queued_at);
alter table public.hfms_notification_deliveries enable row level security;
drop policy if exists notification_delivery_read on public.hfms_notification_deliveries;
create policy notification_delivery_read on public.hfms_notification_deliveries for select using(public.is_head_office() or public.has_branch_role(branch_id,array['owner','finance_manager','accountant','auditor']::public.user_role[]));

-- A reconciliation is approved only when the recorded difference is effectively zero,
-- or an explicit adjustment reason has been supplied.
create or replace function public.hfms_validate_reconciliation_approval()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='approved' and abs(coalesce(new.statement_balance,0)-coalesce(new.ledger_balance,0)) > 0.01 and coalesce(trim(new.notes),'')='' then
   raise exception 'Reconciliation cannot be approved while a difference exists without an adjustment explanation.';
 end if;
 return new;
end; $$;
drop trigger if exists trg_hfms_reconciliation_approval on public.cash_reconciliations;
create trigger trg_hfms_reconciliation_approval before update on public.cash_reconciliations for each row execute function public.hfms_validate_reconciliation_approval();

comment on table public.hfms_reconciliation_matches is 'Controlled bank/M-Pesa/cash reconciliation matches with audit context.';
comment on column public.allocations.transfer_status is 'Profit First transfer lifecycle: not_transferred, pending, transferred, verified, rejected.';
