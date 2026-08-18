-- HFMS Phase 22: Executive Management System
-- Management layer: decisions, KPI targets, briefing snapshots and executive notes.

create table if not exists public.hfms_executive_kpi_targets (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  metric_key text not null,
  target_value numeric(18,2) not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_hfms_exec_targets_branch_period on public.hfms_executive_kpi_targets(branch_id,period_start,period_end,metric_key);

create table if not exists public.hfms_executive_decisions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  title text not null,
  priority text not null default 'medium' check (priority in ('critical','high','medium','low')),
  status text not null default 'open' check (status in ('open','in_progress','completed','dismissed')),
  source text not null default 'executive' check (source in ('executive','ai','accounting','profit_first','tax','reconciliation','budget')),
  description text,
  recommended_action text,
  due_date date,
  owner_user_id uuid,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_hfms_exec_decisions_branch_status on public.hfms_executive_decisions(branch_id,status,priority,due_date);

create table if not exists public.hfms_executive_briefings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  period_start date not null,
  period_end date not null,
  briefing_type text not null default 'executive_daily',
  headline text,
  facts jsonb not null default '{}'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_hfms_exec_briefings_branch_period on public.hfms_executive_briefings(branch_id,period_end desc);

alter table public.hfms_executive_kpi_targets enable row level security;
alter table public.hfms_executive_decisions enable row level security;
alter table public.hfms_executive_briefings enable row level security;

-- Browser access is intentionally blocked. Netlify Functions use the service role
-- after explicit RBAC/branch checks.
drop policy if exists hfms_exec_targets_no_direct_access on public.hfms_executive_kpi_targets;
create policy hfms_exec_targets_no_direct_access on public.hfms_executive_kpi_targets for all to anon, authenticated using (false) with check (false);
drop policy if exists hfms_exec_decisions_no_direct_access on public.hfms_executive_decisions;
create policy hfms_exec_decisions_no_direct_access on public.hfms_executive_decisions for all to anon, authenticated using (false) with check (false);
drop policy if exists hfms_exec_briefings_no_direct_access on public.hfms_executive_briefings;
create policy hfms_exec_briefings_no_direct_access on public.hfms_executive_briefings for all to anon, authenticated using (false) with check (false);
