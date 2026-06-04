create table if not exists public.market_data_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  live_prices_enabled boolean not null default false,
  valuation_mode text not null default 'import_snapshot'
    check (valuation_mode in ('import_snapshot', 'live_prices')),
  preferred_provider text not null default 'auto'
    check (preferred_provider in ('auto', 'finnhub', 'fmp', 'alpha_vantage', 'twelve_data')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, portfolio_id)
);

create table if not exists public.market_data_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null
    check (provider in ('finnhub', 'fmp', 'alpha_vantage', 'twelve_data')),
  encrypted_key text not null,
  key_last4 text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.broker_cash_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  broker_account_id uuid not null references public.broker_accounts(id) on delete cascade,
  amount numeric not null,
  currency text not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, broker_account_id)
);

alter table public.market_data_settings enable row level security;
alter table public.market_data_api_keys enable row level security;
alter table public.broker_cash_overrides enable row level security;

drop trigger if exists set_market_data_settings_updated_at on public.market_data_settings;
create trigger set_market_data_settings_updated_at
before update on public.market_data_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_market_data_api_keys_updated_at on public.market_data_api_keys;
create trigger set_market_data_api_keys_updated_at
before update on public.market_data_api_keys
for each row execute function public.set_updated_at();

drop trigger if exists set_broker_cash_overrides_updated_at on public.broker_cash_overrides;
create trigger set_broker_cash_overrides_updated_at
before update on public.broker_cash_overrides
for each row execute function public.set_updated_at();

create policy "market_data_settings_all_own" on public.market_data_settings
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "market_data_api_keys_all_own" on public.market_data_api_keys
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "broker_cash_overrides_all_own" on public.broker_cash_overrides
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists market_data_settings_user_portfolio_idx
on public.market_data_settings(user_id, portfolio_id);

create index if not exists broker_cash_overrides_user_portfolio_idx
on public.broker_cash_overrides(user_id, portfolio_id);
