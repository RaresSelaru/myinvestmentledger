alter table public.targets
  add column if not exists role text,
  add column if not exists company_type text,
  add column if not exists theme text,
  add column if not exists zone_mode text not null default 'suggested',
  add column if not exists manual_fair_value numeric,
  add column if not exists manual_buy_anchor numeric,
  add column if not exists manual_trim_anchor numeric,
  add column if not exists thesis_integrity_score numeric,
  add column if not exists catalyst_quality_score numeric,
  add column if not exists theme_strength_score numeric,
  add column if not exists value_chain_criticality_score numeric,
  add column if not exists macro_uncertainty_score numeric,
  add column if not exists qualitative_comment text;

update public.targets
set manual_buy_anchor = coalesce(manual_buy_anchor, target_buy_price),
    manual_trim_anchor = coalesce(manual_trim_anchor, target_sell_price)
where manual_buy_anchor is null
   or manual_trim_anchor is null;

do $$
begin
  alter table public.targets
    add constraint targets_role_check
    check (role is null or role in ('core', 'satellite', 'speculative'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.targets
    add constraint targets_company_type_check
    check (
      company_type is null or company_type in (
        'profitable_growth',
        'high_growth_unprofitable',
        'speculative_prerevenue',
        'industrial_infrastructure',
        'cyclical_semiconductor',
        'banks_financials',
        'commodity_exposed'
      )
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.targets
    add constraint targets_zone_mode_check
    check (zone_mode in ('auto', 'manual', 'locked', 'suggested'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.targets
    add constraint targets_manual_score_ranges_check
    check (
      (thesis_integrity_score is null or thesis_integrity_score between 1 and 10)
      and (catalyst_quality_score is null or catalyst_quality_score between 1 and 10)
      and (theme_strength_score is null or theme_strength_score between 1 and 10)
      and (value_chain_criticality_score is null or value_chain_criticality_score between 1 and 10)
      and (macro_uncertainty_score is null or macro_uncertainty_score between 1 and 10)
    );
exception when duplicate_object then null;
end $$;

create table if not exists public.symbol_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  internal_symbol text not null,
  provider text not null,
  provider_symbol text not null,
  exchange text,
  currency text,
  asset_type text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, internal_symbol, provider)
);

create table if not exists public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol_mapping_id uuid references public.symbol_mappings(id) on delete set null,
  provider text not null,
  provider_symbol text not null,
  company_name text,
  sector text,
  industry text,
  country text,
  currency text,
  exchange text,
  asset_type text,
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_symbol)
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_symbol text not null,
  price_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  adjusted_close numeric,
  volume numeric,
  currency text,
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider, provider_symbol, price_date)
);

create table if not exists public.financial_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_symbol text not null,
  statement_type text not null
    check (statement_type in ('income', 'balance_sheet', 'cash_flow')),
  period text not null check (period in ('annual', 'quarterly', 'ttm')),
  fiscal_date date not null,
  currency text,
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (
    user_id,
    provider,
    provider_symbol,
    statement_type,
    period,
    fiscal_date
  )
);

create table if not exists public.financial_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_symbol text not null,
  period text not null default 'ttm',
  fiscal_date date,
  revenue_growth numeric,
  gross_margin numeric,
  operating_margin numeric,
  eps numeric,
  net_income numeric,
  cfo numeric,
  fcf numeric,
  ebitda numeric,
  debt numeric,
  cash numeric,
  current_ratio numeric,
  interest_coverage numeric,
  share_count numeric,
  sbc numeric,
  market_cap numeric,
  enterprise_value numeric,
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider, provider_symbol, period, fiscal_date)
);

create table if not exists public.financial_ratios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_symbol text not null,
  period text not null default 'ttm',
  fiscal_date date,
  pe_ratio numeric,
  forward_pe_ratio numeric,
  ev_sales numeric,
  ev_ebitda numeric,
  fcf_yield numeric,
  debt_to_equity numeric,
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider, provider_symbol, period, fiscal_date)
);

create table if not exists public.decision_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  calculation_version text not null default 'decision-readiness-v1',
  default_zone_mode text not null default 'suggested'
    check (default_zone_mode in ('auto', 'manual', 'locked', 'suggested')),
  risk_bias text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, portfolio_id)
);

create table if not exists public.decision_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null,
  calculation_version text not null,
  scores_json jsonb not null default '{}'::jsonb,
  gates_json jsonb not null default '{}'::jsonb,
  normalized_variables_json jsonb not null default '{}'::jsonb,
  confidence_score numeric not null default 0,
  confidence_label text not null default 'low'
    check (confidence_label in ('high', 'medium', 'low')),
  missing_data_json jsonb not null default '[]'::jsonb,
  stale_data_json jsonb not null default '[]'::jsonb,
  raw_inputs_json jsonb not null default '{}'::jsonb,
  raw_outputs_json jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.price_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null,
  zone_mode text not null default 'suggested'
    check (zone_mode in ('auto', 'manual', 'locked', 'suggested')),
  strong_accumulation numeric,
  light_accumulation numeric,
  hold_low numeric,
  hold_high numeric,
  trim_review numeric,
  strong_trim numeric,
  currency text,
  zone_last_recalculated_at timestamptz,
  zone_recalculation_reason text,
  last_activity_considered_at timestamptz,
  calculation_version text not null default 'decision-readiness-v1',
  raw_inputs_json jsonb not null default '{}'::jsonb,
  raw_outputs_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, portfolio_id, symbol)
);

create table if not exists public.decision_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  symbol text,
  event_type text not null,
  reason text,
  previous_json jsonb not null default '{}'::jsonb,
  next_json jsonb not null default '{}'::jsonb,
  actor text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists public.data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  symbol text,
  scope text not null,
  issue_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  message text not null,
  source text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_refresh_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  provider text not null,
  data_type text not null,
  symbols text[] not null default '{}',
  status text not null check (status in ('started', 'succeeded', 'failed', 'partial')),
  error_message text,
  rows_updated integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

drop trigger if exists set_symbol_mappings_updated_at on public.symbol_mappings;
create trigger set_symbol_mappings_updated_at
before update on public.symbol_mappings
for each row execute function public.set_updated_at();

drop trigger if exists set_company_profiles_updated_at on public.company_profiles;
create trigger set_company_profiles_updated_at
before update on public.company_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_decision_settings_updated_at on public.decision_settings;
create trigger set_decision_settings_updated_at
before update on public.decision_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_price_zones_updated_at on public.price_zones;
create trigger set_price_zones_updated_at
before update on public.price_zones
for each row execute function public.set_updated_at();

drop trigger if exists set_data_quality_issues_updated_at on public.data_quality_issues;
create trigger set_data_quality_issues_updated_at
before update on public.data_quality_issues
for each row execute function public.set_updated_at();

alter table public.symbol_mappings enable row level security;
alter table public.company_profiles enable row level security;
alter table public.price_history enable row level security;
alter table public.financial_statements enable row level security;
alter table public.financial_metrics enable row level security;
alter table public.financial_ratios enable row level security;
alter table public.decision_settings enable row level security;
alter table public.decision_scores enable row level security;
alter table public.price_zones enable row level security;
alter table public.decision_events enable row level security;
alter table public.data_quality_issues enable row level security;
alter table public.data_refresh_logs enable row level security;

create policy "symbol_mappings_all_own" on public.symbol_mappings
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "company_profiles_all_own" on public.company_profiles
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "price_history_all_own" on public.price_history
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "financial_statements_all_own" on public.financial_statements
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "financial_metrics_all_own" on public.financial_metrics
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "financial_ratios_all_own" on public.financial_ratios
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "decision_settings_all_own" on public.decision_settings
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "decision_scores_all_own" on public.decision_scores
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "price_zones_all_own" on public.price_zones
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "decision_events_all_own" on public.decision_events
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "data_quality_issues_all_own" on public.data_quality_issues
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "data_refresh_logs_all_own" on public.data_refresh_logs
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists symbol_mappings_user_symbol_idx
on public.symbol_mappings(user_id, internal_symbol);

create index if not exists company_profiles_user_provider_symbol_idx
on public.company_profiles(user_id, provider, provider_symbol);

create index if not exists price_history_user_symbol_date_idx
on public.price_history(user_id, provider_symbol, price_date desc);

create index if not exists financial_statements_user_symbol_idx
on public.financial_statements(user_id, provider_symbol, fiscal_date desc);

create index if not exists financial_metrics_user_symbol_idx
on public.financial_metrics(user_id, provider_symbol, fiscal_date desc);

create index if not exists financial_ratios_user_symbol_idx
on public.financial_ratios(user_id, provider_symbol, fiscal_date desc);

create index if not exists decision_scores_user_portfolio_symbol_idx
on public.decision_scores(user_id, portfolio_id, symbol, calculated_at desc);

create index if not exists price_zones_user_portfolio_symbol_idx
on public.price_zones(user_id, portfolio_id, symbol);

create index if not exists data_quality_issues_open_idx
on public.data_quality_issues(user_id, portfolio_id, symbol)
where resolved_at is null;

create index if not exists data_refresh_logs_user_status_idx
on public.data_refresh_logs(user_id, status, started_at desc);
