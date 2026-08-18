-- HFMS Phase 8 Production Core
-- Non-destructive. Run AFTER hfms_phase7_financial_core.sql.

-- ============================================================================
-- 1. CASH MOVEMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('opening_balance','revenue','expense','owner_loan_funding','owner_loan_repayment','transfer','tax_payment','profit_allocation','other')),
    direction TEXT NOT NULL CHECK (direction IN ('inflow','outflow')),
    amount_kes NUMERIC(14,2) NOT NULL CHECK (amount_kes >= 0),
    from_account_id UUID REFERENCES public.financial_accounts(id),
    to_account_id UUID REFERENCES public.financial_accounts(id),
    financial_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
    source_ref TEXT,
    description TEXT,
    reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- Ensure all required columns exist on pre-existing table
ALTER TABLE public.cash_movements 
ADD COLUMN IF NOT EXISTS movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS movement_type TEXT NOT NULL DEFAULT 'other',
ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'inflow',
ADD COLUMN IF NOT EXISTS amount_kes NUMERIC(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS from_account_id UUID REFERENCES public.financial_accounts(id),
ADD COLUMN IF NOT EXISTS to_account_id UUID REFERENCES public.financial_accounts(id),
ADD COLUMN IF NOT EXISTS financial_transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_ref TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cash_movements_branch_date ON public.cash_movements(branch_id, movement_date);

-- ============================================================================
-- 2. CASH RECONCILIATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cash_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.financial_accounts(id),
    reconciliation_date DATE NOT NULL,
    system_balance_kes NUMERIC(14,2) NOT NULL DEFAULT 0,
    actual_balance_kes NUMERIC(14,2) NOT NULL DEFAULT 0,
    variance_kes NUMERIC(14,2) GENERATED ALWAYS AS (actual_balance_kes - system_balance_kes) STORED,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','submitted','approved','rejected')),
    explanation TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(branch_id, account_id, reconciliation_date)
);

-- ============================================================================
-- 3. ALLOCATION APPROVALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.allocation_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    requested_by UUID REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    reason TEXT,
    UNIQUE(allocation_id)
);

-- ============================================================================
-- 4. BUDGETS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    period DATE NOT NULL,
    category_id UUID REFERENCES public.categories(id),
    budget_kes NUMERIC(14,2) NOT NULL CHECK (budget_kes >= 0),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(branch_id, period, category_id)
);

-- ============================================================================
-- 5. RECURRING EXPENSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id),
    category_id UUID REFERENCES public.categories(id),
    description TEXT NOT NULL,
    amount_kes NUMERIC(14,2) NOT NULL CHECK (amount_kes >= 0),
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly','annual')),
    next_due_date DATE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. SUPPLIER ALIASES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.supplier_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    alias TEXT NOT NULL
);

-- Safely backfill branch_id and expected columns on pre-existing supplier_aliases table
ALTER TABLE public.supplier_aliases 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS alias TEXT;

ALTER TABLE public.supplier_aliases DROP CONSTRAINT IF EXISTS supplier_aliases_branch_id_alias_key;
ALTER TABLE public.supplier_aliases ADD CONSTRAINT supplier_aliases_branch_id_alias_key UNIQUE (branch_id, alias);

-- ============================================================================
-- 7. INDEXES & SECURITY
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_alerts_open ON public.financial_alerts(branch_id, status, severity);

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_aliases ENABLE ROW LEVEL SECURITY;

-- Read policies
DROP POLICY IF EXISTS cash_movements_read ON public.cash_movements;
CREATE POLICY cash_movements_read ON public.cash_movements FOR SELECT 
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));

DROP POLICY IF EXISTS cash_reconciliations_read ON public.cash_reconciliations;
CREATE POLICY cash_reconciliations_read ON public.cash_reconciliations FOR SELECT 
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));

DROP POLICY IF EXISTS allocation_approvals_read ON public.allocation_approvals;
CREATE POLICY allocation_approvals_read ON public.allocation_approvals FOR SELECT 
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));

DROP POLICY IF EXISTS budgets_read ON public.budgets;
CREATE POLICY budgets_read ON public.budgets FOR SELECT 
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));

DROP POLICY IF EXISTS recurring_expenses_read ON public.recurring_expenses;
CREATE POLICY recurring_expenses_read ON public.recurring_expenses FOR SELECT 
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));

DROP POLICY IF EXISTS supplier_aliases_read ON public.supplier_aliases;
CREATE POLICY supplier_aliases_read ON public.supplier_aliases FOR SELECT 
USING (
    public.is_head_office() 
    OR branch_id IS NULL 
    OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[])
);

-- ============================================================================
-- 8. VIEWS & AUDIT METADATA
-- ============================================================================
CREATE OR REPLACE VIEW public.v_hfms_financial_position AS
SELECT
    branch_id,
    COALESCE(SUM(CASE WHEN transaction_type='revenue' AND direction='inflow' THEN net_amount_kes ELSE 0 END),0) AS revenue_kes,
    COALESCE(SUM(CASE WHEN transaction_type='expense' AND direction='outflow' THEN net_amount_kes ELSE 0 END),0) AS expenses_kes,
    COALESCE(SUM(CASE WHEN transaction_type='owner_loan_funding' AND direction='inflow' THEN net_amount_kes ELSE 0 END),0) AS owner_loan_funding_kes,
    COALESCE(SUM(CASE WHEN transaction_type='owner_loan_repayment' AND direction='outflow' THEN net_amount_kes ELSE 0 END),0) AS owner_loan_repayment_kes,
    COALESCE(SUM(CASE WHEN direction='inflow' THEN net_amount_kes ELSE -net_amount_kes END),0) AS net_ledger_movement_kes
FROM public.financial_transactions
WHERE is_deleted=false AND classification_status='classified'
GROUP BY branch_id;

CREATE OR REPLACE VIEW public.v_hfms_monthly_summary AS
SELECT branch_id,
       DATE_TRUNC('month', transaction_date)::date AS period,
       COALESCE(SUM(CASE WHEN transaction_type='revenue' AND direction='inflow' THEN net_amount_kes ELSE 0 END),0) AS revenue_kes,
       COALESCE(SUM(CASE WHEN transaction_type='expense' AND direction='outflow' THEN net_amount_kes ELSE 0 END),0) AS expense_kes,
       COALESCE(SUM(CASE WHEN transaction_type='owner_loan_funding' AND direction='inflow' THEN net_amount_kes ELSE 0 END),0) AS owner_loan_funding_kes,
       COALESCE(SUM(CASE WHEN transaction_type='owner_loan_repayment' AND direction='outflow' THEN net_amount_kes ELSE 0 END),0) AS owner_loan_repayment_kes
FROM public.financial_transactions
WHERE is_deleted=false AND classification_status='classified'
GROUP BY branch_id, DATE_TRUNC('month', transaction_date)::date;

ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS change_reason TEXT;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS source_record_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_ft_source_hash ON public.financial_transactions(branch_id, source_system, source_record_hash);

ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.loan_payments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_loan_payments_active ON public.loan_payments(loan_id,is_deleted,payment_date);