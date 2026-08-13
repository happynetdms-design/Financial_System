-- HFMS Phase 15: AI Finance Copilot + enterprise workflow layer
-- Additive migration. No financial records are deleted or rewritten.

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  user_id uuid not null,
  title text,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null,
  message_type text not null default 'chat',
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_action_requests (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  user_id uuid not null,
  conversation_id uuid references public.ai_conversations(id),
  action_type text not null,
  action_payload jsonb not null default '{}'::jsonb,
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  status text not null default 'draft' check (status in ('draft','awaiting_confirmation','approved','rejected','executed','failed','cancelled')),
  confirmation_text text,
  execution_result jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  executed_at timestamptz
);

create index if not exists idx_ai_conversations_branch on public.ai_conversations(branch_id, updated_at desc);
create index if not exists idx_ai_messages_conversation on public.ai_messages(conversation_id, created_at);
create index if not exists idx_ai_actions_branch on public.ai_action_requests(branch_id, created_at desc);

-- Financial control metadata for AI-generated recommendations and approvals.
create table if not exists public.financial_recommendations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  created_by uuid,
  recommendation_type text not null,
  title text not null,
  evidence jsonb not null default '{}'::jsonb,
  recommendation text not null,
  expected_impact jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','accepted','rejected','implemented','expired')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Document intelligence queue: supports receipt/invoice/bank-statement extraction without
-- forcing the AI to write directly into the ledger.
create table if not exists public.document_intelligence_queue (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null,
  uploaded_by uuid,
  document_type text not null check (document_type in ('receipt','invoice','bank_statement','mpesa_statement','tende_export','organization_utility','other')),
  storage_path text,
  extracted_data jsonb,
  confidence numeric(5,4),
  status text not null default 'queued' check (status in ('queued','processing','review','approved','rejected','posted')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Basic RLS; server-side functions still enforce RBAC explicitly.
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_action_requests enable row level security;
alter table public.financial_recommendations enable row level security;
alter table public.document_intelligence_queue enable row level security;

create or replace view public.ai_financial_health as
select
  ft.branch_id,
  coalesce(sum(case when ft.transaction_type='revenue' then ft.net_amount_kes else 0 end),0) as revenue,
  coalesce(sum(case when ft.transaction_type='expense' then ft.net_amount_kes else 0 end),0) as expenses,
  coalesce(sum(case when ft.transaction_type='owner_loan_funding' then ft.net_amount_kes else 0 end),0) as owner_loan_funding,
  coalesce(sum(case when ft.transaction_type='owner_loan_repayment' then ft.net_amount_kes else 0 end),0) as owner_loan_repayment,
  count(*) as transaction_count
from public.financial_transactions ft
where ft.is_deleted=false
  and ft.classification_status='classified'
group by ft.branch_id;
