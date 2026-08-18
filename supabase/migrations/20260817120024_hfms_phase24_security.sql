-- HFMS Phase 24 — Enterprise Security Completion
-- Run after hfms_phase23_automation.sql.
-- The Netlify service role is intentionally used only behind application RBAC.
-- These RLS policies are a second line of defense for direct authenticated access.

CREATE TABLE IF NOT EXISTS public.hfms_security_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    control_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    status TEXT NOT NULL DEFAULT 'PASS',
    enabled BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    implementation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hfms_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT,
    result TEXT NOT NULL DEFAULT 'SUCCESS',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safely add missing columns if tables pre-existed
ALTER TABLE public.hfms_security_events 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'LOG',
ADD COLUMN IF NOT EXISTS resource TEXT,
ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'SUCCESS',
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_hfms_security_events_created ON public.hfms_security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hfms_security_events_branch ON public.hfms_security_events(branch_id, created_at DESC);

ALTER TABLE public.hfms_security_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hfms_security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hfms_security_controls_read ON public.hfms_security_controls;
CREATE POLICY hfms_security_controls_read ON public.hfms_security_controls FOR SELECT TO authenticated USING (public.is_head_office());

DROP POLICY IF EXISTS hfms_security_events_read ON public.hfms_security_events;
CREATE POLICY hfms_security_events_read ON public.hfms_security_events FOR SELECT TO authenticated USING (public.is_head_office());

INSERT INTO public.hfms_security_controls(control_key,name,severity,status,description,implementation) VALUES
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
ON CONFLICT(control_key) DO UPDATE SET name=excluded.name,severity=excluded.severity,status=excluded.status,description=excluded.description,implementation=excluded.implementation,updated_at=now();

-- Generic read-only second-line RLS for Phase 7–23 branch-scoped tables
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema='public' AND c.column_name='branch_id'
          AND c.table_name IN (
            'financial_transactions','cash_movements','cash_reconciliations','allocation_approvals','allocation_proofs',
            'budgets','budget_approvals','anomaly_events','anomaly_rules','financial_alerts','financial_recommendations',
            'financial_import_batches','financial_report_runs','financial_statement_snapshots','journal_entries','accounting_periods',
            'chart_of_accounts','recurring_expenses','recurring_expense_runs','profit_first_cycles','profit_first_compliance',
            'reconciliation_exceptions','reconciliation_import_rows','reconciliation_lines','reconciliation_matches','reconciliation_audit_events',
            'ai_conversations','ai_action_requests','document_intelligence_queue','ai_scenarios',
            'ai_cfo_preferences','ai_cfo_memory','ai_cfo_briefings','ai_cfo_reports','ai_financial_insights',
            'tax_profile','tax_periods','tax_evidence','tax_compliance_events','tax_deadline_rules',
            'hfms_automation_rules','hfms_notification_queue','hfms_automation_events','hfms_executive_kpi_targets','hfms_executive_decisions','hfms_executive_briefings',
            'hfms_opening_balances','supplier_aliases','supplier_statements'
          )
        GROUP BY c.table_name
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
        EXECUTE format('DROP POLICY IF EXISTS hfms_%s_branch_read ON public.%I', r.table_name, r.table_name);
        EXECUTE format('CREATE POLICY hfms_%s_branch_read ON public.%I FOR SELECT TO authenticated USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY[''branch_manager'',''accountant'',''auditor'',''viewer'']::public.user_role[]))', r.table_name, r.table_name);
    END LOOP;
END $$;

-- AI conversations/messages owner policies
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hfms_ai_conversations_owner ON public.ai_conversations;
CREATE POLICY hfms_ai_conversations_owner ON public.ai_conversations FOR ALL TO authenticated
USING (auth.uid() = user_id OR public.is_head_office())
WITH CHECK (auth.uid() = user_id OR public.is_head_office());

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hfms_ai_messages_owner ON public.ai_messages;
CREATE POLICY hfms_ai_messages_owner ON public.ai_messages FOR ALL TO authenticated
USING (EXISTS(SELECT 1 FROM public.ai_conversations c WHERE c.id=ai_messages.conversation_id AND (c.user_id=auth.uid() OR public.is_head_office())))
WITH CHECK (EXISTS(SELECT 1 FROM public.ai_conversations c WHERE c.id=ai_messages.conversation_id AND (c.user_id=auth.uid() OR public.is_head_office())));

REVOKE INSERT, UPDATE, DELETE ON public.hfms_security_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.hfms_security_controls FROM authenticated;