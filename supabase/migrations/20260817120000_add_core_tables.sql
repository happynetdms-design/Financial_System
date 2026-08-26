-- ==========================================
-- 0. ENUM TYPES & HELPER FUNCTIONS
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('super_admin', 'branch_manager', 'accountant', 'auditor', 'viewer');
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_head_office()
RETURNS boolean AS $$
BEGIN
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_branch_role(target_branch_id UUID, required_roles public.user_role[])
RETURNS boolean AS $$
BEGIN
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 1. PREREQUISITE BASE TABLES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_branch_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    role public.user_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, branch_id)
);

-- ==========================================
-- 2. TRANSACTION DEPENDENCY TABLES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    loan_name TEXT,
    amount NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    payment_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.revenue_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    amount NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    amount NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    allocation_name TEXT,
    amount_kes NUMERIC(14,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 3. CURRENCIES & MULTI-CURRENCY
-- ==========================================
CREATE TABLE IF NOT EXISTS public.currencies (
    code VARCHAR(3) PRIMARY KEY,
    name TEXT NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    exchange_rate_to_base NUMERIC(15, 6) DEFAULT 1.0,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.currencies (code, name, symbol) 
VALUES ('USD', 'US Dollar', '$'), ('KES', 'Kenyan Shilling', 'KSh'), ('EUR', 'Euro', '€')
ON CONFLICT (code) DO NOTHING;

-- ==========================================
-- 4. DOUBLE-ENTRY JOURNAL LEDGER
-- ==========================================
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    entry_number TEXT NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    posted_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.journal_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    debit NUMERIC(15, 2) DEFAULT 0.00,
    credit NUMERIC(15, 2) DEFAULT 0.00,
    memo TEXT
);

-- ==========================================
-- 5. CASH & BANK RECONCILIATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.cash_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
    statement_date DATE NOT NULL,
    statement_ending_balance NUMERIC(15, 2) NOT NULL,
    cleared_balance NUMERIC(15, 2) NOT NULL,
    status TEXT DEFAULT 'in_progress',
    reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ
);

-- ==========================================
-- 6. ENTERPRISE SECURITY & AUDITING
-- ==========================================
CREATE TABLE IF NOT EXISTS public.hfms_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    payload JSONB,
    severity TEXT DEFAULT 'info',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 7. AUTOMATION CENTER & RUNNER
-- ==========================================
CREATE TABLE IF NOT EXISTS public.automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES public.automation_rules(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    execution_details JSONB,
    executed_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 8. ENABLE ROW-LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hfms_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 9. ACCESS POLICIES
-- ==========================================
DROP POLICY IF EXISTS "Allow public read access for currencies" ON public.currencies;
DROP POLICY IF EXISTS "Access journal_entries via branch" ON public.journal_entries;
DROP POLICY IF EXISTS "User security events" ON public.hfms_security_events;
DROP POLICY IF EXISTS "Allow authenticated users on automation rules" ON public.automation_rules;
DROP POLICY IF EXISTS "Allow authenticated users on categories" ON public.categories;

CREATE POLICY "Allow public read access for currencies" 
ON public.currencies FOR SELECT USING (true);

CREATE POLICY "Access journal_entries via branch" 
ON public.journal_entries FOR ALL 
USING (
    branch_id IN (SELECT branch_id FROM public.user_branch_access WHERE user_id = auth.uid())
    OR branch_id IS NULL
);

CREATE POLICY "User security events" 
ON public.hfms_security_events FOR ALL 
USING (
    user_id = auth.uid() OR auth.uid() IS NOT NULL
);

CREATE POLICY "Allow authenticated users on automation rules" 
ON public.automation_rules FOR ALL 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users on categories" 
ON public.categories FOR ALL 
USING (auth.uid() IS NOT NULL);