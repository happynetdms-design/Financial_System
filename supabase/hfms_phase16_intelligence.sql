-- HFMS Phase 16: executive intelligence + scenario planning
-- Additive only. No financial records are deleted or rewritten.

create table if not exists public.ai_scenarios (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  user_id uuid not null,
  name text not null,
  assumptions jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  classification text not null default 'FORECAST' check (classification in ('CALCULATION','FORECAST','RECOMMENDATION')),
  created_at timestamptz not null default now()
);

create index if not exists ai_scenarios_branch_created_idx
  on public.ai_scenarios(branch_id, created_at desc);

alter table public.ai_scenarios enable row level security;

drop policy if exists ai_scenarios_select on public.ai_scenarios;
create policy ai_scenarios_select on public.ai_scenarios
for select using (auth.uid() = user_id);

drop policy if exists ai_scenarios_insert on public.ai_scenarios;
create policy ai_scenarios_insert on public.ai_scenarios
for insert with check (auth.uid() = user_id);

comment on table public.ai_scenarios is 'Non-posting what-if scenarios. Never treated as ledger truth.';
