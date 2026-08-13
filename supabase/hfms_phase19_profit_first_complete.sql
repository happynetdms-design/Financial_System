-- HFMS Phase 19: Complete Profit First Operating Cycle
-- Run after Phase 18 reconciliation migration. Non-destructive.
create table if not exists public.profit_first_cycles (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  period date not null,
  revenue_kes numeric(14,2) not null default 0,
  target_pct_total numeric(6,2) not null default 100,
  status text not null default 'prepared' check (status in ('prepared','pending_approval','approved','in_progress','completed','closed','reopened')),
  prepared_by uuid references auth.users(id), prepared_at timestamptz,
  requested_by uuid references auth.users(id), requested_at timestamptz,
  approved_by uuid references auth.users(id), approved_at timestamptz,
  closed_by uuid references auth.users(id), closed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(branch_id,period)
);
create table if not exists public.profit_first_compliance (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  period date not null,
  score numeric(6,2) not null default 0,
  status text not null default 'at_risk' check (status in ('excellent','healthy','needs_attention','at_risk')),
  target_kes numeric(14,2) not null default 0,
  transferred_kes numeric(14,2) not null default 0,
  verified_count integer not null default 0,
  allocation_count integer not null default 0,
  variance_kes numeric(14,2) not null default 0,
  coaching_message text,
  calculated_at timestamptz not null default now(),
  unique(branch_id,period)
);
alter table public.allocations add column if not exists transfer_status text not null default 'pending';
alter table public.allocations add column if not exists transfer_reference text;
alter table public.allocations add column if not exists transferred_amount_kes numeric(14,2) not null default 0;
alter table public.allocations add column if not exists transferred_at timestamptz;
alter table public.allocations add column if not exists transferred_by uuid references auth.users(id);
alter table public.allocations add column if not exists variance_kes numeric(14,2) not null default 0;
alter table public.profit_first_cycles enable row level security;
alter table public.profit_first_compliance enable row level security;
drop policy if exists pf_cycles_read on public.profit_first_cycles;
create policy pf_cycles_read on public.profit_first_cycles for select using (public.is_head_office() or public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
drop policy if exists pf_compliance_read on public.profit_first_compliance;
create policy pf_compliance_read on public.profit_first_compliance for select using (public.is_head_office() or public.has_branch_role(branch_id,array['branch_manager','accountant','auditor','viewer']::public.user_role[]));
create index if not exists idx_pf_cycles_branch_period on public.profit_first_cycles(branch_id,period desc);
create index if not exists idx_pf_compliance_branch_period on public.profit_first_compliance(branch_id,period desc);
