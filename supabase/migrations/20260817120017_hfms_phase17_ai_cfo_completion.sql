-- HFMS Phase 17: AI CFO completion layer
-- Additive. Run after hfms_phase16_intelligence.sql.

create table if not exists public.ai_cfo_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  briefing_frequency text not null default 'daily' check (briefing_frequency in ('realtime','daily','weekly','monthly')),
  preferred_tone text not null default 'executive' check (preferred_tone in ('executive','controller','plain')),
  default_currency text not null default 'KES',
  show_forecasts boolean not null default true,
  proactive_alerts boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(user_id, branch_id)
);

create table if not exists public.ai_cfo_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  memory_type text not null check(memory_type in ('instruction','business_context','preference','decision','goal')),
  content text not null,
  source text not null default 'user',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_cfo_memory_branch_user on public.ai_cfo_memory(branch_id,user_id,active,updated_at desc);

create table if not exists public.ai_cfo_briefings (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  period_start date,
  period_end date,
  briefing jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists idx_ai_cfo_briefings_branch on public.ai_cfo_briefings(branch_id,generated_at desc);

create table if not exists public.ai_cfo_reports (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  report_type text not null,
  title text not null,
  period_start date,
  period_end date,
  report_data jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check(status in ('draft','final','archived')),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_cfo_reports_branch on public.ai_cfo_reports(branch_id,created_at desc);

alter table public.ai_cfo_preferences enable row level security;
alter table public.ai_cfo_memory enable row level security;
alter table public.ai_cfo_briefings enable row level security;
alter table public.ai_cfo_reports enable row level security;

-- Server-side functions enforce RBAC. These policies are intentionally restrictive for direct client access.
drop policy if exists ai_cfo_preferences_owner on public.ai_cfo_preferences;
create policy ai_cfo_preferences_owner on public.ai_cfo_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ai_cfo_memory_owner on public.ai_cfo_memory;
create policy ai_cfo_memory_owner on public.ai_cfo_memory for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ai_cfo_briefings_read on public.ai_cfo_briefings;
create policy ai_cfo_briefings_read on public.ai_cfo_briefings for select using (auth.uid() = user_id or public.is_head_office() or public.has_branch_role(branch_id, array['owner','finance_manager','accountant','branch_manager','auditor']::public.user_role[]));

drop policy if exists ai_cfo_reports_read on public.ai_cfo_reports;
create policy ai_cfo_reports_read on public.ai_cfo_reports for select using (auth.uid() = user_id or public.is_head_office() or public.has_branch_role(branch_id, array['owner','finance_manager','accountant','branch_manager','auditor']::public.user_role[]));
