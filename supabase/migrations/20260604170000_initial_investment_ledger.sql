create extension if not exists pgcrypto;

do $$
begin
  create type public.transaction_type as enum (
    'buy',
    'sell',
    'deposit',
    'withdrawal',
    'fee',
    'tax',
    'dividend',
    'internal_transfer',
    'note'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.transaction_source as enum ('manual', 'xtb_import');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  default_currency text not null default 'RON',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  base_currency text not null default 'RON',
  risk_assumption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (user_id, portfolio_id)
);

create table if not exists public.broker_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  name text not null,
  broker text not null default 'XTB',
  base_currency text not null default 'RON',
  account_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.imported_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  broker_account_id uuid not null references public.broker_accounts(id) on delete cascade,
  original_filename text not null,
  storage_bucket text not null default 'broker-reports',
  storage_path text not null,
  file_hash text not null,
  parser text not null default 'xtb_excel_stub',
  status text not null default 'pending',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, broker_account_id, file_hash)
);

create table if not exists public.raw_import_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  broker_account_id uuid not null references public.broker_accounts(id) on delete cascade,
  imported_file_id uuid not null references public.imported_files(id) on delete cascade,
  source_row_number integer not null,
  row_hash text not null,
  raw_payload jsonb not null,
  normalized_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, imported_file_id, source_row_number),
  unique (user_id, broker_account_id, row_hash)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  broker_account_id uuid references public.broker_accounts(id) on delete set null,
  imported_file_id uuid references public.imported_files(id) on delete set null,
  raw_import_row_id uuid references public.raw_import_rows(id) on delete set null,
  trade_date date not null,
  type public.transaction_type not null,
  symbol text,
  quantity numeric,
  price numeric,
  amount numeric not null,
  currency text not null,
  source public.transaction_source not null default 'manual',
  external_id text,
  comment text,
  reconciled_transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, broker_account_id, source, external_id)
);

create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null,
  company_name text,
  quantity numeric not null default 0,
  average_cost numeric not null default 0,
  current_price numeric not null default 0,
  currency text not null default 'RON',
  market_value numeric not null default 0,
  cost_basis numeric not null default 0,
  realized_pl numeric not null default 0,
  unrealized_pl numeric not null default 0,
  target_allocation numeric not null default 0,
  max_allocation numeric,
  target_buy_price numeric,
  target_sell_price numeric,
  core_percent numeric not null default 100,
  satellite_percent numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, portfolio_id, symbol)
);

create table if not exists public.targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol text not null,
  target_allocation numeric not null default 0,
  max_allocation numeric,
  target_buy_price numeric,
  target_sell_price numeric,
  core_percent numeric not null default 100,
  satellite_percent numeric not null default 0,
  conviction_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, portfolio_id, symbol)
);

create table if not exists public.manual_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  broker_account_id uuid references public.broker_accounts(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  symbol text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.internal_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  from_broker_account_id uuid not null references public.broker_accounts(id) on delete cascade,
  to_broker_account_id uuid not null references public.broker_accounts(id) on delete cascade,
  from_transaction_id uuid references public.transactions(id) on delete set null,
  to_transaction_id uuid references public.transactions(id) on delete set null,
  transfer_date date not null,
  amount numeric not null,
  currency text not null,
  fx_rate numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_broker_account_id <> to_broker_account_id)
);

create table if not exists public.market_data_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  currency text not null,
  price numeric not null,
  provider text,
  as_of timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, symbol, currency)
);

create table if not exists public.recommendation_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  kind text not null check (kind in ('accumulation', 'trimming')),
  symbol text not null,
  score numeric not null default 0,
  factors jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists portfolios_user_id_idx on public.portfolios(user_id);
create index if not exists portfolio_memberships_user_id_idx on public.portfolio_memberships(user_id);
create index if not exists portfolio_memberships_portfolio_id_idx on public.portfolio_memberships(portfolio_id);
create index if not exists broker_accounts_user_id_idx on public.broker_accounts(user_id);
create index if not exists broker_accounts_portfolio_id_idx on public.broker_accounts(portfolio_id);
create index if not exists imported_files_user_id_idx on public.imported_files(user_id);
create index if not exists raw_import_rows_user_id_idx on public.raw_import_rows(user_id);
create index if not exists transactions_user_portfolio_date_idx on public.transactions(user_id, portfolio_id, trade_date desc);
create index if not exists transactions_symbol_idx on public.transactions(user_id, portfolio_id, symbol);
create index if not exists holdings_user_portfolio_symbol_idx on public.holdings(user_id, portfolio_id, symbol);
create index if not exists targets_user_portfolio_symbol_idx on public.targets(user_id, portfolio_id, symbol);
create index if not exists internal_transfers_user_portfolio_idx on public.internal_transfers(user_id, portfolio_id);
create index if not exists market_data_cache_user_symbol_idx on public.market_data_cache(user_id, symbol);
create index if not exists recommendation_snapshots_user_portfolio_idx on public.recommendation_snapshots(user_id, portfolio_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_portfolios_updated_at on public.portfolios;
create trigger set_portfolios_updated_at
before update on public.portfolios
for each row execute function public.set_updated_at();

drop trigger if exists set_broker_accounts_updated_at on public.broker_accounts;
create trigger set_broker_accounts_updated_at
before update on public.broker_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_imported_files_updated_at on public.imported_files;
create trigger set_imported_files_updated_at
before update on public.imported_files
for each row execute function public.set_updated_at();

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_holdings_updated_at on public.holdings;
create trigger set_holdings_updated_at
before update on public.holdings
for each row execute function public.set_updated_at();

drop trigger if exists set_targets_updated_at on public.targets;
create trigger set_targets_updated_at
before update on public.targets
for each row execute function public.set_updated_at();

drop trigger if exists set_manual_notes_updated_at on public.manual_notes;
create trigger set_manual_notes_updated_at
before update on public.manual_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_internal_transfers_updated_at on public.internal_transfers;
create trigger set_internal_transfers_updated_at
before update on public.internal_transfers
for each row execute function public.set_updated_at();

drop trigger if exists set_market_data_cache_updated_at on public.market_data_cache;
create trigger set_market_data_cache_updated_at
before update on public.market_data_cache
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.portfolio_memberships enable row level security;
alter table public.broker_accounts enable row level security;
alter table public.imported_files enable row level security;
alter table public.raw_import_rows enable row level security;
alter table public.transactions enable row level security;
alter table public.holdings enable row level security;
alter table public.targets enable row level security;
alter table public.manual_notes enable row level security;
alter table public.internal_transfers enable row level security;
alter table public.market_data_cache enable row level security;
alter table public.recommendation_snapshots enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "profiles_delete_own" on public.profiles
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "portfolios_all_own" on public.portfolios
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "portfolio_memberships_all_own" on public.portfolio_memberships
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "broker_accounts_all_own" on public.broker_accounts
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "imported_files_all_own" on public.imported_files
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "raw_import_rows_all_own" on public.raw_import_rows
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions_all_own" on public.transactions
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "holdings_all_own" on public.holdings
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "targets_all_own" on public.targets
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "manual_notes_all_own" on public.manual_notes
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "internal_transfers_all_own" on public.internal_transfers
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "market_data_cache_all_own" on public.market_data_cache
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "recommendation_snapshots_all_own" on public.recommendation_snapshots
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, default_currency)
  values (new.id, new.email, 'RON')
  on conflict (user_id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'broker-reports',
  'broker-reports',
  false,
  52428800,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "broker_reports_select_own" on storage.objects
for select to authenticated
using (
  bucket_id = 'broker-reports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "broker_reports_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'broker-reports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "broker_reports_update_own" on storage.objects
for update to authenticated
using (
  bucket_id = 'broker-reports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'broker-reports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "broker_reports_delete_own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'broker-reports'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
