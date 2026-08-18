-- HFMS Phase 12: Professional Accounting Layer
-- Adds a real chart of accounts, double-entry journal, accounting periods,
-- period close controls, trial-balance reporting, and statement-ready views.
-- Non-destructive: does not delete existing HFMS data.

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
    parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    is_control BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(branch_id, code)
);

CREATE TABLE IF NOT EXISTS public.accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','reopened')),
    closed_by UUID REFERENCES auth.users(id),
    closed_at TIMESTAMPTZ,
    reopened_by UUID REFERENCES auth.users(id),
    reopened_at TIMESTAMPTZ,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(branch_id, period_start, period_end),
    CHECK(period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference TEXT,
    description TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'manual',
    source_id UUID,
    status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('draft','posted','void')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    posted_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    void_reason TEXT
);

-- Safely add missing columns to journal_entries if it pre-existed
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('draft','posted','void')),
ADD COLUMN IF NOT EXISTS entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_id UUID,
ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE TABLE IF NOT EXISTS public.journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
    debit_kes NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(debit_kes >= 0),
    credit_kes NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(credit_kes >= 0),
    memo TEXT,
    CHECK((debit_kes = 0 AND credit_kes > 0) OR (credit_kes = 0 AND debit_kes > 0))
);

CREATE INDEX IF NOT EXISTS idx_coa_branch_code ON public.chart_of_accounts(branch_id, code);
CREATE INDEX IF NOT EXISTS idx_period_branch_dates ON public.accounting_periods(branch_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_journal_branch_date ON public.journal_entries(branch_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(account_id);

-- Seed a professional baseline chart of accounts for every existing branch.
DO $$
DECLARE b RECORD;
BEGIN
    FOR b IN SELECT id FROM public.branches WHERE is_active=true LOOP
        INSERT INTO public.chart_of_accounts(branch_id,code,name,account_type,is_control) VALUES
            (b.id,'1000','Cash & Bank','asset',true),
            (b.id,'1100','M-Pesa / Mobile Money','asset',true),
            (b.id,'1200','Accounts Receivable','asset',true),
            (b.id,'1300','Other Current Assets','asset',false),
            (b.id,'2000','Accounts Payable','liability',true),
            (b.id,'2100','Tax Payable','liability',true),
            (b.id,'2200','Owner Loan Payable','liability',true),
            (b.id,'3000','Owner Equity','equity',true),
            (b.id,'3100','Retained Earnings','equity',true),
            (b.id,'4000','Internet Service Revenue','revenue',true),
            (b.id,'5000','Operating Expenses','expense',true),
            (b.id,'5100','Bank & Payment Charges','expense',true),
            (b.id,'5200','Taxes & Licences','expense',false)
        ON CONFLICT(branch_id,code) DO NOTHING;
    END LOOP;
END $$;

-- Trial balance view: only posted journal entries contribute.
CREATE OR REPLACE VIEW public.v_hfms_trial_balance AS
SELECT
    je.branch_id,
    jl.account_id,
    coa.code,
    coa.name,
    coa.account_type,
    COALESCE(SUM(jl.debit_kes),0) AS total_debit_kes,
    COALESCE(SUM(jl.credit_kes),0) AS total_credit_kes,
    COALESCE(SUM(jl.debit_kes - jl.credit_kes),0) AS net_balance_kes
FROM public.journal_entries je
JOIN public.journal_lines jl ON jl.journal_entry_id = je.id
JOIN public.chart_of_accounts coa ON coa.id = jl.account_id
WHERE COALESCE(je.status, 'posted') = 'posted'
GROUP BY je.branch_id, jl.account_id, coa.code, coa.name, coa.account_type;

-- Closed periods are immutable. Reopening is an explicit controlled action.
CREATE OR REPLACE FUNCTION public.hfms_period_is_closed(p_branch UUID, p_date DATE)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
    SELECT EXISTS(SELECT 1 FROM public.accounting_periods p WHERE p.branch_id=p_branch AND p.status='closed' AND p_date BETWEEN p.period_start AND p.period_end);
$$;

CREATE OR REPLACE FUNCTION public.hfms_block_closed_financial_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
    IF public.hfms_period_is_closed(COALESCE(NEW.branch_id,OLD.branch_id),COALESCE(NEW.transaction_date,OLD.transaction_date)) THEN
        RAISE EXCEPTION 'Accounting period is closed for this transaction date. Reopen the period through HFMS controls before making changes.';
    END IF;
    RETURN COALESCE(NEW,OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_hfms_closed_period_financial_tx ON public.financial_transactions;
CREATE TRIGGER trg_hfms_closed_period_financial_tx
BEFORE INSERT OR UPDATE OR DELETE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.hfms_block_closed_financial_transaction();

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coa_read ON public.chart_of_accounts;
CREATE POLICY coa_read ON public.chart_of_accounts FOR SELECT USING(public.is_head_office() OR public.has_branch_role(branch_id,ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));
DROP POLICY IF EXISTS periods_read ON public.accounting_periods;
CREATE POLICY periods_read ON public.accounting_periods FOR SELECT USING(public.is_head_office() OR public.has_branch_role(branch_id,ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));
DROP POLICY IF EXISTS journal_read ON public.journal_entries;
CREATE POLICY journal_read ON public.journal_entries FOR SELECT USING(public.is_head_office() OR public.has_branch_role(branch_id,ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));
DROP POLICY IF EXISTS journal_lines_read ON public.journal_lines;
CREATE POLICY journal_lines_read ON public.journal_lines FOR SELECT USING(EXISTS(SELECT 1 FROM public.journal_entries je WHERE je.id=journal_entry_id AND (public.is_head_office() OR public.has_branch_role(je.branch_id,ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]))));

-- Audit every journal mutation.
CREATE OR REPLACE FUNCTION public.audit_hfms_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
    INSERT INTO public.audit_log(table_name,record_id,action,old_data,new_data,changed_by,reason)
    VALUES(TG_TABLE_NAME,COALESCE(NEW.id,OLD.id),LOWER(TG_OP),CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,auth.uid(),'Professional accounting journal mutation');
    RETURN COALESCE(NEW,OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_hfms_journal ON public.journal_entries;
CREATE TRIGGER trg_audit_hfms_journal AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.audit_hfms_journal();
DROP TRIGGER IF EXISTS trg_audit_hfms_journal_lines ON public.journal_lines;
CREATE TRIGGER trg_audit_hfms_journal_lines AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION public.audit_hfms_journal();

-- Prevent unbalanced posted journal entries.
CREATE OR REPLACE FUNCTION public.hfms_check_journal_balance(p_entry UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
    SELECT ABS(COALESCE(SUM(debit_kes),0)-COALESCE(SUM(credit_kes),0)) < 0.005 FROM public.journal_lines WHERE journal_entry_id=p_entry;
$$;

-- Reusable management KPI view.
CREATE OR REPLACE VIEW public.v_hfms_management_kpis AS
SELECT
    ft.branch_id,
    COALESCE(SUM(CASE WHEN ft.transaction_type='revenue' AND ft.direction='in' THEN ft.net_amount_kes ELSE 0 END),0) AS revenue_kes,
    COALESCE(SUM(CASE WHEN ft.transaction_type='expense' AND ft.direction='out' THEN ft.net_amount_kes ELSE 0 END),0) AS expenses_kes,
    COALESCE(SUM(CASE WHEN ft.transaction_type='owner_loan_funding' AND ft.direction='in' THEN ft.net_amount_kes ELSE 0 END),0) AS owner_funding_kes,
    COALESCE(SUM(CASE WHEN ft.transaction_type='owner_loan_repayment' AND ft.direction='out' THEN ft.net_amount_kes ELSE 0 END),0) AS owner_repayment_kes,
    COALESCE(SUM(CASE WHEN ft.direction='in' THEN ft.net_amount_kes ELSE 0 END),0) AS cash_in_kes,
    COALESCE(SUM(CASE WHEN ft.direction='out' THEN ft.net_amount_kes ELSE 0 END),0) AS cash_out_kes
FROM public.financial_transactions ft
WHERE COALESCE(ft.is_deleted,false)=false AND COALESCE(ft.classification_status,'classified')='classified'
GROUP BY ft.branch_id;

COMMENT ON TABLE public.chart_of_accounts IS 'Professional double-entry chart of accounts for HFMS.';
COMMENT ON TABLE public.accounting_periods IS 'Controlled accounting periods with close/reopen workflow.';
COMMENT ON TABLE public.journal_entries IS 'Posted accounting journal headers; all posted entries must balance.';