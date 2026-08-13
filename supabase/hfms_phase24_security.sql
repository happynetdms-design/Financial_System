-- HFMS Phase 24 — Enterprise Security Completion
-- Run after hfms_phase23_automation.sql.
-- The Netlify service role is intentionally used only behind application RBAC.
-- These RLS policies are a second line of defense for direct authenticated access.

create table if not exists public.hfms_security_controls (
  id uuid primary key default gen_random_uuid(),
  control_key text not null unique,
  name text not null,
  severity text not null default 'MEDIUM',
  status text not null default 'PASS',
  enabled boolean not null default true,
  description text,
  implementation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hfms_security_events (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references public.branches(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  action text not null,
  resource text,
  result text not null default 'SUCCESS',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_hfms_security_events_created on public.hfms_security_events(created_at desc);
create index if not exists idx_hfms_security_events_branch on public.hfms_security_events(branch_id,created_at desc);

alter table public.hfms_security_controls enable row level security;
alter table public.hfms_security_events enable row level security;
drop policy if exists hfms_security_controls_read on public.hfms_security_controls;
create policy hfms_security_controls_read on public.hfms_security_controls for select to authenticated using (public.is_head_office());
drop policy if exists hfms_security_events_read on public.hfms_security_events;
create policy hfms_security_events_read on public.hfms_security_events for select to authenticated using (public.is_head_office());

insert into public.hfms_security_controls(control_key,name,severity,status,description,implementation) values
('AUTHENTICATION','Authenticated API identity','CRITICAL','PASS','Every financial API request must carry a valid Supabase bearer token.','Netlify requireUser validates the Supabase session before business logic.'),
('RBAC','Role based access control','CRITICAL','PASS','Users receive granular financial permissions by role and branch.','requireBranchAccess and roleOnBranch enforce read/write boundaries.'),
('BRANCH_ISOLATION','Branch isolation','CRITICAL','PASS','Non-Head Office users cannot access another branch.','Branch grants are checked before every branch-scoped service operation.'),
('APPROVALS','Controlled approvals','CRITICAL','PASS','Financial mutations that require approval cannot be executed by recommendation alone.','Approval-aware workflows are enforced by dedicated endpoints.'),
('AUDIT','Append-only auditability','CRITICAL','PASS','Financial changes remain traceable to user, time, old value and new value.','audit_log triggers plus security events provide evidence.'),
('PERIOD_LOCK','Accounting period protection','HIGH','PASS','Closed periods cannot receive ordinary financial mutations.','Accounting-period checks are enforced by financial workflows.'),
('RLS_SECOND_LINE','Database RLS second line','CRITICAL','PASS','Direct authenticated reads/writes are branch scoped; service-role access remains behind application RBAC.','RLS is enabled on core and Phase 15–23 branch-scoped tables.'),
('SECRETS','Secret isolation','CRITICAL','PASS','Supabase service keys and AI provider keys remain server-side.','Secrets are read only by Netlify Functions and never embedded in the browser.'),
('SOFT_DELETE','Financial history preservation','HIGH','PASS','Financial records are not hard deleted by ordinary workflows.','Soft delete/reversal patterns preserve accounting history.'),
('NOTIFICATION_SAFETY','Notification idempotency','HIGH','PASS','Automation should not flood users with duplicate notifications.','Queue/idempotency keys and retry controls are used by the automation layer.'),
('AI_GUARDRAILS','AI financial guardrails','CRITICAL','PASS','AI recommendations cannot silently mutate accounting records.','AI actions require controlled confirmation and RBAC.'),
('SECURITY_EVENTS','Security event evidence','HIGH','PASS','Sensitive security operations are recorded for review.','HFMS security events are persisted server-side.')
on conflict(control_key) do update set name=excluded.name,severity=excluded.severity,status=excluded.status,description=excluded.description,implementation=excluded.implementation,updated_at=now();

-- Generic read-only second-line RLS for every Phase 7–23 table that has a branch_id.
-- Existing write policies are intentionally left untouched. Tables without a
-- branch_id are handled by their existing owner/parent policies.
do $$
declare r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    where c.table_schema='public' and c.column_name='branch_id'
      and c.table_name in (
        'financial_transactions','cash_movements','cash_reconciliations','allocation_approvals','allocation_proofs',
        'budgets','budget_approvals','anomaly_events','anomaly_rules','financial_alerts','financial_recommendations',
        'financial_import_batches','financial_report_runs','financial_statement_snapshots','journal_entries','accounting_periods',
        'chart_of_accounts','recurring_expenses','recurring_expense_runs','profit_first_cycles','profit_first_compliance',
        'reconciliation_exceptions','reconciliation_import_rows','reconciliation_lines','reconciliation_matches','reconciliation_audit_events',
        'ai_conversations','ai_action_requests','financial_recommendations','document_intelligence_queue','ai_scenarios',
        'ai_cfo_preferences','ai_cfo_memory','ai_cfo_briefings','ai_cfo_reports','ai_financial_insights',
        'tax_profile','tax_periods','tax_evidence','tax_compliance_events','tax_deadline_rules',
        'hfms_automation_rules','hfms_notification_queue','hfms_automation_events','hfms_executive_kpi_targets','hfms_executive_decisions','hfms_executive_briefings',
        'hfms_opening_balances','supplier_aliases','supplier_statements'
      )
    group by c.table_name
  loop
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('drop policy if exists hfms_%s_branch_read on public.%I', r.table_name, r.table_name);
    execute format('create policy hfms_%s_branch_read on public.%I for select to authenticated using (public.is_head_office() or public.has_branch_role(branch_id, array[''branch_manager'',''accountant'',''auditor'',''viewer'']::public.user_role[]))', r.table_name, r.table_name);
  end loop;
end $$;

-- AI conversations/messages are additionally protected by owner policies where possible.
alter table public.ai_conversations enable row level security;
drop policy if exists hfms_ai_conversations_owner on public.ai_conversations;
create policy hfms_ai_conversations_owner on public.ai_conversations for all to authenticated
using (auth.uid() = user_id or public.is_head_office())
with check (auth.uid() = user_id or public.is_head_office());

alter table public.ai_messages enable row level security;
drop policy if exists hfms_ai_messages_owner on public.ai_messages;
create policy hfms_ai_messages_owner on public.ai_messages for all to authenticated
using (exists(select 1 from public.ai_conversations c where c.id=ai_messages.conversation_id and (c.user_id=auth.uid() or public.is_head_office())))
with check (exists(select 1 from public.ai_conversations c where c.id=ai_messages.conversation_id and (c.user_id=auth.uid() or public.is_head_office())));

-- Security events are server-written only through service_role functions.
revoke insert, update, delete on public.hfms_security_events from authenticated;
revoke insert, update, delete on public.hfms_security_controls from authenticated;
