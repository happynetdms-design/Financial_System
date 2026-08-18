-- HFMS Phase 23: Automation & Notification Orchestration
-- Additive, auditable, branch-scoped. No financial action is auto-executed
-- unless the corresponding rule is explicitly enabled with auto_execute=true.

create table if not exists public.hfms_automation_rules (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  rule_key text not null,
  name text not null,
  description text,
  enabled boolean not null default true,
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  channel text not null default 'in_app' check (channel in ('in_app','email','sms','webhook')),
  lead_days integer not null default 30 check (lead_days >= 0),
  threshold_kes numeric(14,2),
  auto_execute boolean not null default false,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id, rule_key)
);

create table if not exists public.hfms_notification_queue (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  rule_key text not null,
  channel text not null check (channel in ('in_app','email','sms','webhook')),
  recipient text,
  subject text,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hfms_automation_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('scheduled','manual','webhook')),
  status text not null default 'running' check (status in ('running','completed','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  branches_scanned integer not null default 0,
  rules_evaluated integer not null default 0,
  notifications_created integer not null default 0,
  notifications_sent integer not null default 0,
  actions_prepared integer not null default 0,
  actions_executed integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  error_message text
);

create table if not exists public.hfms_automation_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.hfms_automation_runs(id) on delete set null,
  branch_id uuid not null references public.branches(id) on delete cascade,
  rule_key text not null,
  event_key text not null,
  severity text not null,
  observed_value numeric(14,2),
  threshold_value numeric(14,2),
  message text not null,
  action text not null default 'notify',
  created_at timestamptz not null default now(),
  unique(branch_id, event_key)
);

create index if not exists idx_hfms_automation_rules_branch on public.hfms_automation_rules(branch_id, enabled);
create index if not exists idx_hfms_notification_queue_ready on public.hfms_notification_queue(status, next_attempt_at);
create index if not exists idx_hfms_automation_events_branch on public.hfms_automation_events(branch_id, created_at desc);
create index if not exists idx_hfms_automation_runs_started on public.hfms_automation_runs(started_at desc);

alter table public.hfms_automation_rules enable row level security;
alter table public.hfms_notification_queue enable row level security;
alter table public.hfms_automation_runs enable row level security;
alter table public.hfms_automation_events enable row level security;

drop policy if exists hfms_automation_rules_read on public.hfms_automation_rules;
create policy hfms_automation_rules_read on public.hfms_automation_rules for select to authenticated
using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));

drop policy if exists hfms_notification_queue_read on public.hfms_notification_queue;
create policy hfms_notification_queue_read on public.hfms_notification_queue for select to authenticated
using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));

drop policy if exists hfms_automation_runs_read on public.hfms_automation_runs;
create policy hfms_automation_runs_read on public.hfms_automation_runs for select to authenticated
using (public.is_head_office());
-- Automation runs are company-wide. Branch users read run summaries through the
-- authenticated Netlify Function, which applies branch authorization to detail data.
drop policy if exists hfms_automation_events_read on public.hfms_automation_events;
create policy hfms_automation_events_read on public.hfms_automation_events for select to authenticated
using (public.is_head_office() or public.has_branch_role(branch_id, array['branch_manager','accountant','auditor','viewer']::public.user_role[]));

-- Seed the rule catalogue for every active branch. Values are deliberately conservative.
insert into public.hfms_automation_rules
(branch_id, rule_key, name, description, enabled, severity, channel, lead_days, auto_execute)
select b.id, r.rule_key, r.name, r.description, true, r.severity, 'in_app', r.lead_days, false
from public.branches b
cross join (values
 ('low_cash','Low operating cash','Warn when available cash falls below the configured minimum cash target.','critical',0),
 ('budget_overrun','Budget overrun','Warn when current-period actual expenditure exceeds budget.','warning',0),
 ('profit_first_missing','Profit First cycle incomplete','Warn when an allocation has not reached verified/closed status.','warning',0),
 ('tax_due','Tax deadline approaching','Warn when an unpaid tax period is within the configured lead window.','warning',30),
 ('tax_overdue','Tax obligation overdue','Escalate unpaid tax periods past their due date.','critical',0),
 ('anomaly_open','Financial anomaly open','Notify management when unresolved anomaly events exist.','warning',0),
 ('recurring_due','Recurring expense due','Create a controlled task when a recurring expense is due.','info',7),
 ('negative_result','Negative operating result','Warn when current-period expenses exceed revenue.','critical',0),
 ('reconciliation_pending','Reconciliation pending','Remind management when a cash reconciliation remains open or pending approval.','warning',0)
) r(rule_key,name,description,severity,lead_days)
where b.is_active = true
on conflict (branch_id, rule_key) do nothing;

-- Future branches can be initialized by the automation runner.
