-- HFMS Phase 13: Financial statement completion, opening balances and reporting controls.
-- Additive/non-destructive. Run after Phase 12.
create table if not exists public.hfms_opening_balances (
 id uuid primary key default gen_random_uuid(),
 branch_id uuid not null references public.branches(id) on delete cascade,
 account_id uuid not null references public.chart_of_accounts(id),
 amount_kes numeric(14,2) not null,
 effective_date date not null,
 reason text not null,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists idx_hfms_opening_balances_branch on public.hfms_opening_balances(branch_id,effective_date);
alter table public.hfms_opening_balances enable row level security;
drop policy if exists opening_balances_read on public.hfms_opening_balances;
create policy opening_balances_read on public.hfms_opening_balances for select using(public.is_head_office() or public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists opening_balances_write on public.hfms_opening_balances;
create policy opening_balances_write on public.hfms_opening_balances for insert with check(public.is_head_office() or public.has_branch_role(branch_id,array['owner','finance_manager','accountant']::public.user_role[]));
create or replace view public.v_hfms_opening_balance_summary as
select branch_id, count(*) entries, coalesce(sum(amount_kes),0) total_opening_balance_kes from public.hfms_opening_balances group by branch_id;
comment on table public.hfms_opening_balances is 'Controlled opening balances for migration into HFMS professional accounting.';
