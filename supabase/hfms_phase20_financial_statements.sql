-- HFMS Phase 20: Enterprise Financial Statements
-- Adds statement metadata, cash-flow classifications and reporting notes.
-- Non-destructive.
alter table public.chart_of_accounts add column if not exists cash_flow_category text check (cash_flow_category is null or cash_flow_category in ('operating','investing','financing','non_cash'));
update public.chart_of_accounts set cash_flow_category='operating' where cash_flow_category is null and account_type in ('revenue','expense');
update public.chart_of_accounts set cash_flow_category='financing' where cash_flow_category is null and code in ('2200','3000','3100');
update public.chart_of_accounts set cash_flow_category='operating' where cash_flow_category is null and code in ('1000','1100','1200','2000','2100','1300');
create table if not exists public.financial_report_runs (
 id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches(id) on delete cascade,
 report_type text not null check(report_type in ('profit_loss','balance_sheet','cash_flow','equity','trial_balance','general_ledger','management_pack')),
 period_start date not null, period_end date not null, comparative_start date, comparative_end date,
 generated_by uuid references auth.users(id), generated_at timestamptz not null default now(), notes text
);
alter table public.financial_report_runs enable row level security;
drop policy if exists financial_report_runs_read on public.financial_report_runs;
create policy financial_report_runs_read on public.financial_report_runs for select using(public.is_head_office() or public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
create index if not exists idx_financial_report_runs_branch_period on public.financial_report_runs(branch_id,period_end desc);
