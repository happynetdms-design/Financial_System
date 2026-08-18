-- HFMS Phase 21: Tax Intelligence & Compliance Engine
-- Additive migration. Does not invent liabilities or tax rates.

CREATE TABLE IF NOT EXISTS public.tax_deadline_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_type TEXT NOT NULL,
    jurisdiction TEXT NOT NULL DEFAULT 'Kenya',
    frequency TEXT NOT NULL,
    due_rule TEXT NOT NULL,
    filing_due_rule TEXT,
    authority TEXT NOT NULL DEFAULT 'KRA',
    source_url TEXT,
    source_note TEXT,
    effective_from DATE,
    effective_to DATE,
    verified_at TIMESTAMPTZ,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tax_deadline_rules_active
ON public.tax_deadline_rules(tax_type, jurisdiction, frequency, due_rule)
WHERE active = true;

CREATE TABLE IF NOT EXISTS public.tax_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    tax_obligation_id UUID REFERENCES public.tax_obligations(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    filing_due_date DATE,
    payment_due_date DATE,
    amount_due_kes NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount_paid_kes NUMERIC(14,2) NOT NULL DEFAULT 0,
    filing_status TEXT NOT NULL DEFAULT 'not_due' CHECK (filing_status IN ('not_due','draft','ready','filed','amended','nil','not_applicable')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partially_paid','paid','overpaid','not_applicable')),
    filed_at TIMESTAMPTZ,
    filing_reference TEXT,
    payment_reference TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(branch_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS public.tax_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_period_id UUID NOT NULL REFERENCES public.tax_periods(id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('return_acknowledgement','payment_slip','payment_receipt','withholding_certificate','tcc','assessment','other')),
    reference TEXT,
    storage_path TEXT,
    notes TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tax_compliance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    tax_period_id UUID REFERENCES public.tax_periods(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    reason TEXT,
    actor_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tax_profile (
    branch_id UUID PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
    taxpayer_name TEXT,
    kra_pin TEXT,
    accounting_year_end_month INT NOT NULL DEFAULT 12 CHECK (accounting_year_end_month BETWEEN 1 AND 12),
    tcc_status TEXT NOT NULL DEFAULT 'unknown' CHECK (tcc_status IN ('unknown','valid','expiring','expired','not_available')),
    tcc_expiry_date DATE,
    last_tcc_check_date DATE,
    etims_compliant BOOLEAN,
    vat_registered BOOLEAN,
    tax_agent_name TEXT,
    tax_agent_contact TEXT,
    notes TEXT,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed rule-level deadlines
INSERT INTO public.tax_deadline_rules (tax_type, frequency, due_rule, filing_due_rule, authority, source_url, source_note, verified_at)
SELECT * FROM (VALUES
 ('VAT','Monthly','20th day of following month','20th day of following month','KRA','https://www.kra.go.ke/individual/filing-paying/types-of-taxes/value-added-tax','KRA states VAT return and payment are due on or before the 20th day of the following month.',now()),
 ('PAYE','Monthly','9th day of following month','9th day of following month','KRA','https://www.kra.go.ke/individual/filing-paying/types-of-taxes/paye','KRA states PAYE filing and payment are due on or before the 9th day of the following month.',now()),
 ('Withholding Tax','Transaction','Within 5 working days after deduction','Within 5 working days after deduction','KRA','https://www.kra.go.ke/individual/filing-paying/types-of-taxes/individual-withholding-tax','KRA states withholding tax is remitted within five working days after deduction.',now()),
 ('Turnover Tax','Monthly','20th day of following month','20th day of following month','KRA','https://www.kra.go.ke/images/publications/English-Service-charter-April-2026.pdf','KRA 2025/26 service charter lists monthly filing/payment due on or before the 20th of the following month.',now()),
 ('Corporation Tax','Annual','Balance payment: 30th day of fourth month after accounting period; return: within six months','Within six months from accounting period end','KRA','https://www.kra.go.ke/images/publications/English-Service-charter-April-2026.pdf','KRA 2025/26 service charter deadline summary.',now()),
 ('Installment Tax','Quarterly','20th day of the fourth, sixth, ninth and twelfth month of financial year','Quarterly','KRA','https://www.kra.go.ke/images/publications/English-Service-charter-April-2026.pdf','KRA 2025/26 service charter deadline summary.',now())
) AS v(tax_type,frequency,due_rule,filing_due_rule,authority,source_url,source_note,verified_at)
WHERE NOT EXISTS (
  SELECT 1 FROM public.tax_deadline_rules r WHERE r.tax_type=v.tax_type AND r.frequency=v.frequency AND r.due_rule=v.due_rule AND r.active=true
);

CREATE INDEX IF NOT EXISTS idx_tax_periods_branch_dates ON public.tax_periods(branch_id, period_end);
CREATE INDEX IF NOT EXISTS idx_tax_periods_due ON public.tax_periods(payment_due_date, filing_due_date);
CREATE INDEX IF NOT EXISTS idx_tax_events_branch ON public.tax_compliance_events(branch_id, created_at DESC);

ALTER TABLE public.tax_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_compliance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_deadline_rules ENABLE ROW LEVEL SECURITY;

-- Standardized RLS Policies using public.has_branch_role() & public.is_head_office()
DROP POLICY IF EXISTS "tax periods read" ON public.tax_periods;
CREATE POLICY "tax periods read" ON public.tax_periods FOR SELECT TO authenticated
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));

DROP POLICY IF EXISTS "tax periods write" ON public.tax_periods;
CREATE POLICY "tax periods write" ON public.tax_periods FOR ALL TO authenticated
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant']::public.user_role[]))
WITH CHECK (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant']::public.user_role[]));

DROP POLICY IF EXISTS "tax evidence read" ON public.tax_evidence;
CREATE POLICY "tax evidence read" ON public.tax_evidence FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.tax_periods p 
    WHERE p.id = tax_evidence.tax_period_id 
    AND (public.is_head_office() OR public.has_branch_role(p.branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]))
));

DROP POLICY IF EXISTS "tax evidence write" ON public.tax_evidence;
CREATE POLICY "tax evidence write" ON public.tax_evidence FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.tax_periods p 
    WHERE p.id = tax_evidence.tax_period_id 
    AND (public.is_head_office() OR public.has_branch_role(p.branch_id, ARRAY['branch_manager','accountant']::public.user_role[]))
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.tax_periods p 
    WHERE p.id = tax_evidence.tax_period_id 
    AND (public.is_head_office() OR public.has_branch_role(p.branch_id, ARRAY['branch_manager','accountant']::public.user_role[]))
));

DROP POLICY IF EXISTS "tax profile read" ON public.tax_profile;
CREATE POLICY "tax profile read" ON public.tax_profile FOR SELECT TO authenticated
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));

DROP POLICY IF EXISTS "tax profile write" ON public.tax_profile;
CREATE POLICY "tax profile write" ON public.tax_profile FOR ALL TO authenticated
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant']::public.user_role[]))
WITH CHECK (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant']::public.user_role[]));

DROP POLICY IF EXISTS "tax deadline rules read" ON public.tax_deadline_rules;
CREATE POLICY "tax deadline rules read" ON public.tax_deadline_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tax events read" ON public.tax_compliance_events;
CREATE POLICY "tax events read" ON public.tax_compliance_events FOR SELECT TO authenticated
USING (public.is_head_office() OR public.has_branch_role(branch_id, ARRAY['branch_manager','accountant','auditor','viewer']::public.user_role[]));

COMMENT ON TABLE public.tax_periods IS 'Tax liabilities/filing periods. Amounts are entered or produced by controlled calculations; HFMS does not invent tax liabilities.';
COMMENT ON TABLE public.tax_deadline_rules IS 'Configurable tax deadline rules with authoritative source references. Verify before relying on legal deadlines.';