-- HFMS Phase 10: enterprise accounting, reconciliation and reporting layer.
-- Additive/non-destructive.

-- 1. Ensure cash_reconciliations exists and has required Phase 10 columns
CREATE TABLE IF NOT EXISTS public.cash_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
    account_id UUID REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
    period_start DATE,
    period_end DATE,
    statement_balance NUMERIC(18,2) DEFAULT 0,
    ledger_balance NUMERIC(18,2) DEFAULT 0,
    status TEXT DEFAULT 'open' CHECK(status IN ('open','submitted','approved','rejected')),
    prepared_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Safely add missing columns if table pre-existed from earlier schemas
ALTER TABLE public.cash_reconciliations 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS period_start DATE,
ADD COLUMN IF NOT EXISTS period_end DATE,
ADD COLUMN IF NOT EXISTS statement_balance NUMERIC(18,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ledger_balance NUMERIC(18,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS prepared_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Remaining Phase 10 Tables
CREATE TABLE IF NOT EXISTS public.reconciliation_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL REFERENCES public.cash_reconciliations(id) ON DELETE CASCADE,
    ledger_transaction_id UUID,
    external_reference TEXT,
    external_date DATE,
    external_amount NUMERIC(18,2),
    match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK(match_status IN ('matched','unmatched','excluded')),
    match_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_statement_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    statement_type TEXT NOT NULL CHECK(statement_type IN ('pnl','cash_flow','balance_sheet','profit_first','management_pack')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_key TEXT NOT NULL,
    in_app BOOLEAN NOT NULL DEFAULT true,
    email BOOLEAN NOT NULL DEFAULT false,
    sms BOOLEAN NOT NULL DEFAULT false,
    threshold NUMERIC(18,2),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(branch_id, user_id, event_key)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_cash_recon_branch_period ON public.cash_reconciliations(branch_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_recon_matches_recon ON public.reconciliation_matches(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_statement_snapshots_branch_period ON public.financial_statement_snapshots(branch_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_branch ON public.notification_preferences(branch_id, event_key);

-- 4. Enable RLS
ALTER TABLE public.cash_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_statement_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;