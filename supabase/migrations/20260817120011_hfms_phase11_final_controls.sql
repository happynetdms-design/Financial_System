-- HFMS Phase 11: final production controls and accounting hardening.
-- Additive/non-destructive. Run after Phase 10.

-- 1. Suppliers and Aliases
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    canonical_name TEXT NOT NULL,
    tax_pin TEXT,
    phone TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(branch_id, canonical_name)
);

ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS canonical_name TEXT;

CREATE TABLE IF NOT EXISTS public.supplier_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(supplier_id, alias)
);

-- 2. Recurring Expenses & Runs
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount_kes NUMERIC(18,2) NOT NULL DEFAULT 0,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    next_run_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recurring_expense_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_expense_id UUID NOT NULL REFERENCES public.recurring_expenses(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    run_period DATE NOT NULL,
    financial_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('posted','skipped','failed','pending_approval')),
    amount_kes NUMERIC(18,2) NOT NULL DEFAULT 0,
    error_message TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(recurring_expense_id, run_period)
);

-- 3. Ensure cash_movements exists so vocabulary normalization doesn't crash
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
    amount_kes NUMERIC(18,2) NOT NULL DEFAULT 0,
    direction TEXT NOT NULL CHECK (direction IN ('in', 'out', 'inflow', 'outflow')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Reconciliations, Notifications, and AI Insights
CREATE TABLE IF NOT EXISTS public.reconciliation_import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES public.cash_reconciliations(id) ON DELETE CASCADE,
    external_reference TEXT,
    external_date DATE,
    external_description TEXT,
    external_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    external_direction TEXT NOT NULL CHECK(external_direction IN ('in','out')),
    matched_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
    match_score NUMERIC(6,3),
    match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK(match_status IN ('matched','unmatched','excluded','manual')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_key TEXT NOT NULL,
    channel TEXT NOT NULL CHECK(channel IN ('in_app','email','sms')),
    recipient TEXT,
    subject TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sent','failed','skipped')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.ai_financial_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    insight_type TEXT NOT NULL,
    classification TEXT NOT NULL CHECK(classification IN ('FACT','CALCULATION','FORECAST','RECOMMENDATION','RISK')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_branch_name ON public.suppliers(branch_id, canonical_name);
CREATE INDEX IF NOT EXISTS idx_supplier_aliases_alias ON public.supplier_aliases(lower(alias));
CREATE INDEX IF NOT EXISTS idx_recurring_runs_branch_period ON public.recurring_expense_runs(branch_id, run_period DESC);
CREATE INDEX IF NOT EXISTS idx_recon_import_rows_recon ON public.reconciliation_import_rows(reconciliation_id, match_status);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON public.notification_outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_insights_branch_created ON public.ai_financial_insights(branch_id, created_at DESC);

-- 6. Views
CREATE OR REPLACE VIEW public.hfms_daily_financial_position AS
SELECT
    branch_id,
    transaction_date,
    COALESCE(SUM(CASE WHEN transaction_type='revenue' AND direction='in' THEN net_amount_kes ELSE 0 END),0) AS revenue_kes,
    COALESCE(SUM(CASE WHEN transaction_type='expense' AND direction='out' THEN net_amount_kes ELSE 0 END),0) AS expenses_kes,
    COALESCE(SUM(CASE WHEN transaction_type='owner_loan_funding' AND direction='in' THEN net_amount_kes ELSE 0 END),0) AS owner_funding_kes,
    COALESCE(SUM(CASE WHEN transaction_type='owner_loan_repayment' AND direction='out' THEN net_amount_kes ELSE 0 END),0) AS owner_repayment_kes,
    COALESCE(SUM(CASE WHEN direction='in' THEN net_amount_kes ELSE -net_amount_kes END),0) AS net_cash_movement_kes
FROM public.financial_transactions
WHERE COALESCE(is_deleted,false)=false AND classification_status='classified'
GROUP BY branch_id, transaction_date;

CREATE OR REPLACE VIEW public.hfms_branch_executive_position AS
SELECT
    b.id AS branch_id,
    b.name AS branch_name,
    COALESCE(SUM(CASE WHEN ft.transaction_type='revenue' AND ft.direction='in' THEN ft.net_amount_kes ELSE 0 END),0) AS revenue_kes,
    COALESCE(SUM(CASE WHEN ft.transaction_type='expense' AND ft.direction='out' THEN ft.net_amount_kes ELSE 0 END),0) AS expenses_kes,
    COALESCE(SUM(CASE WHEN ft.transaction_type='owner_loan_funding' AND ft.direction='in' THEN ft.net_amount_kes ELSE 0 END),0) AS owner_funding_kes,
    COALESCE(SUM(CASE WHEN ft.transaction_type='owner_loan_repayment' AND ft.direction='out' THEN ft.net_amount_kes ELSE 0 END),0) AS owner_repayment_kes,
    COUNT(ft.id) AS transaction_count
FROM public.branches b
LEFT JOIN public.financial_transactions ft ON ft.branch_id=b.id AND COALESCE(ft.is_deleted,false)=false AND COALESCE(ft.classification_status,'classified')='classified'
GROUP BY b.id, b.name;

-- 7. Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expense_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_financial_insights ENABLE ROW LEVEL SECURITY;

-- 8. Vocabulary Normalization
ALTER TABLE public.financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_direction_check;
UPDATE public.financial_transactions SET direction='in' WHERE direction='inflow';
UPDATE public.financial_transactions SET direction='out' WHERE direction='outflow';
ALTER TABLE public.financial_transactions ADD CONSTRAINT financial_transactions_direction_check CHECK (direction IN ('in','out'));

ALTER TABLE public.cash_movements DROP CONSTRAINT IF EXISTS cash_movements_direction_check;
UPDATE public.cash_movements SET direction='in' WHERE direction='inflow';
UPDATE public.cash_movements SET direction='out' WHERE direction='outflow';
ALTER TABLE public.cash_movements ADD CONSTRAINT cash_movements_direction_check CHECK (direction IN ('in','out'));

-- Legacy Compatible View
CREATE OR REPLACE VIEW public.v_hfms_financial_position AS
SELECT
    branch_id,
    COALESCE(SUM(CASE WHEN transaction_type='revenue' AND direction='in' THEN net_amount_kes ELSE 0 END),0) AS revenue_kes,
    COALESCE(SUM(CASE WHEN transaction_type='expense' AND direction='out' THEN net_amount_kes ELSE 0 END),0) AS expenses_kes,
    COALESCE(SUM(CASE WHEN transaction_type='owner_loan_funding' AND direction='in' THEN net_amount_kes ELSE 0 END),0) AS owner_loan_funding_kes,
    COALESCE(SUM(CASE WHEN transaction_type='owner_loan_repayment' AND direction='out' THEN net_amount_kes ELSE 0 END),0) AS owner_loan_repayment_kes,
    COALESCE(SUM(CASE WHEN direction='in' THEN net_amount_kes ELSE -net_amount_kes END),0) AS net_ledger_movement_kes
FROM public.financial_transactions
WHERE is_deleted=false AND classification_status='classified'
GROUP BY branch_id;

-- 9. RLS Policies
DROP POLICY IF EXISTS suppliers_read ON public.suppliers;
CREATE POLICY suppliers_read ON public.suppliers FOR SELECT 
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));

DROP POLICY IF EXISTS supplier_aliases_read_v11 ON public.supplier_aliases;
CREATE POLICY supplier_aliases_read_v11 ON public.supplier_aliases FOR SELECT 
USING (public.is_head_office() OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND (public.is_head_office() OR public.has_branch_role(s.branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]))));

DROP POLICY IF EXISTS recurring_runs_read ON public.recurring_expense_runs;
CREATE POLICY recurring_runs_read ON public.recurring_expense_runs FOR SELECT 
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));

DROP POLICY IF EXISTS reconciliation_import_rows_read ON public.reconciliation_import_rows;
CREATE POLICY reconciliation_import_rows_read ON public.reconciliation_import_rows FOR SELECT 
USING (public.is_head_office() OR EXISTS (SELECT 1 FROM public.cash_reconciliations cr WHERE cr.id=reconciliation_id AND (public.is_head_office() OR public.has_branch_role(cr.branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]))));

DROP POLICY IF EXISTS ai_financial_insights_read ON public.ai_financial_insights;
CREATE POLICY ai_financial_insights_read ON public.ai_financial_insights FOR SELECT 
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));