alter type public.transaction_type add value if not exists 'interest';
alter type public.transaction_type add value if not exists 'adjustment';
alter type public.transaction_source add value if not exists 'system';

alter table public.imported_files
  add column if not exists file_name text,
  add column if not exists imported_at timestamptz not null default now(),
  add column if not exists report_start_date date,
  add column if not exists report_end_date date,
  add column if not exists account_currency text,
  add column if not exists import_stats jsonb not null default '{}'::jsonb;

update public.imported_files
set file_name = coalesce(file_name, original_filename),
    import_stats = case
      when import_stats = '{}'::jsonb then coalesce(result, '{}'::jsonb)
      else import_stats
    end
where file_name is null or import_stats = '{}'::jsonb;

alter table public.raw_import_rows
  add column if not exists sheet_name text,
  add column if not exists row_number integer,
  add column if not exists raw_json jsonb,
  add column if not exists source_fingerprint text,
  add column if not exists full_row_hash text,
  add column if not exists status text not null default 'new';

update public.raw_import_rows
set row_number = coalesce(row_number, source_row_number),
    raw_json = coalesce(raw_json, raw_payload),
    full_row_hash = coalesce(full_row_hash, row_hash),
    source_fingerprint = coalesce(source_fingerprint, row_hash)
where row_number is null
   or raw_json is null
   or full_row_hash is null
   or source_fingerprint is null;

create unique index if not exists raw_import_rows_source_fingerprint_key
on public.raw_import_rows(user_id, broker_account_id, source_fingerprint);

alter table public.transactions
  add column if not exists occurred_at timestamptz,
  add column if not exists source_type text,
  add column if not exists transaction_type text,
  add column if not exists is_reconciled boolean not null default false,
  add column if not exists reconciled_with_transaction_id uuid references public.transactions(id) on delete set null,
  add column if not exists source_fingerprint text,
  add column if not exists full_row_hash text;

update public.transactions
set occurred_at = coalesce(occurred_at, trade_date::timestamptz),
    source_type = coalesce(source_type, source::text),
    transaction_type = coalesce(transaction_type, type::text),
    reconciled_with_transaction_id = coalesce(reconciled_with_transaction_id, reconciled_transaction_id)
where occurred_at is null
   or source_type is null
   or transaction_type is null
   or reconciled_with_transaction_id is null;

create unique index if not exists transactions_source_fingerprint_key
on public.transactions(user_id, broker_account_id, source_fingerprint)
where source_fingerprint is not null;

create index if not exists transactions_reconciliation_idx
on public.transactions(user_id, portfolio_id, source_type, transaction_type, symbol, occurred_at);

create table if not exists public.position_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  broker_account_id uuid not null references public.broker_accounts(id) on delete cascade,
  imported_file_id uuid references public.imported_files(id) on delete set null,
  raw_import_row_id uuid references public.raw_import_rows(id) on delete set null,
  symbol text not null,
  side text not null default 'buy',
  quantity numeric not null,
  open_price numeric not null,
  current_price numeric,
  cost_basis numeric not null,
  market_value numeric,
  unrealized_pl numeric,
  currency text not null,
  opened_at timestamptz,
  source_fingerprint text not null,
  full_row_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, broker_account_id, source_fingerprint)
);

create table if not exists public.cash_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  broker_account_id uuid not null references public.broker_accounts(id) on delete cascade,
  imported_file_id uuid references public.imported_files(id) on delete set null,
  raw_import_row_id uuid references public.raw_import_rows(id) on delete set null,
  operation_type text not null,
  normalized_type public.transaction_type not null,
  amount numeric not null,
  currency text not null,
  occurred_at timestamptz not null,
  description text,
  symbol text,
  source_fingerprint text not null,
  full_row_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, broker_account_id, source_fingerprint)
);

create table if not exists public.holdings_snapshot (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  broker_account_id uuid references public.broker_accounts(id) on delete set null,
  imported_file_id uuid references public.imported_files(id) on delete set null,
  symbol text not null,
  quantity numeric not null default 0,
  average_cost numeric not null default 0,
  cost_basis numeric not null default 0,
  current_price numeric not null default 0,
  market_value numeric not null default 0,
  market_value_base numeric,
  unrealized_pl numeric not null default 0,
  realized_pl numeric not null default 0,
  currency text not null,
  snapshot_at timestamptz not null default now(),
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.broker_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  broker_account_id uuid not null references public.broker_accounts(id) on delete cascade,
  imported_file_id uuid references public.imported_files(id) on delete set null,
  balance numeric,
  equity numeric,
  margin numeric,
  free_margin numeric,
  margin_level numeric,
  currency text not null,
  snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.targets
  add column if not exists target_allocation_pct numeric,
  add column if not exists max_allocation_pct numeric,
  add column if not exists core_pct numeric,
  add column if not exists satellite_pct numeric,
  add column if not exists risk_level text,
  add column if not exists notes text,
  add column if not exists recommendations_disabled boolean not null default false;

update public.targets
set target_allocation_pct = coalesce(target_allocation_pct, target_allocation),
    max_allocation_pct = coalesce(max_allocation_pct, max_allocation),
    core_pct = coalesce(core_pct, core_percent),
    satellite_pct = coalesce(satellite_pct, satellite_percent)
where target_allocation_pct is null
   or core_pct is null
   or satellite_pct is null;

alter table public.holdings
  add column if not exists source_refs jsonb not null default '[]'::jsonb;

alter table public.internal_transfers
  add column if not exists from_amount numeric,
  add column if not exists from_currency text,
  add column if not exists to_amount numeric,
  add column if not exists to_currency text,
  add column if not exists occurred_at timestamptz,
  add column if not exists linked_from_transaction_id uuid references public.transactions(id) on delete set null,
  add column if not exists linked_to_transaction_id uuid references public.transactions(id) on delete set null,
  add column if not exists comment text,
  add column if not exists match_confidence numeric;

update public.internal_transfers
set from_amount = coalesce(from_amount, amount),
    from_currency = coalesce(from_currency, currency),
    to_amount = coalesce(to_amount, amount),
    to_currency = coalesce(to_currency, currency),
    occurred_at = coalesce(occurred_at, transfer_date::timestamptz),
    linked_from_transaction_id = coalesce(linked_from_transaction_id, from_transaction_id),
    linked_to_transaction_id = coalesce(linked_to_transaction_id, to_transaction_id)
where occurred_at is null
   or from_amount is null
   or to_amount is null;

alter table public.market_data_cache
  add column if not exists data_type text,
  add column if not exists payload jsonb,
  add column if not exists fetched_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists is_stale boolean not null default false;

update public.market_data_cache
set data_type = coalesce(data_type, 'quote'),
    payload = coalesce(payload, jsonb_build_object('price', price, 'currency', currency)),
    fetched_at = coalesce(fetched_at, as_of),
    expires_at = coalesce(expires_at, as_of + interval '2 minutes')
where data_type is null
   or payload is null
   or fetched_at is null
   or expires_at is null;

create unique index if not exists market_data_cache_user_symbol_type_key
on public.market_data_cache(user_id, symbol, provider, data_type, currency);

alter table public.recommendation_snapshots
  add column if not exists final_score numeric,
  add column if not exists factor_scores jsonb not null default '{}'::jsonb,
  add column if not exists actual_allocation_pct numeric,
  add column if not exists target_allocation_pct numeric,
  add column if not exists drift_pct numeric,
  add column if not exists current_price numeric,
  add column if not exists target_price numeric,
  add column if not exists data_freshness timestamptz,
  add column if not exists missing_data_notes text[] not null default '{}';

update public.recommendation_snapshots
set final_score = coalesce(final_score, score),
    factor_scores = case
      when factor_scores = '{}'::jsonb then coalesce(factors, '{}'::jsonb)
      else factor_scores
    end
where final_score is null;

create index if not exists position_lots_user_portfolio_symbol_idx
on public.position_lots(user_id, portfolio_id, symbol);

create index if not exists cash_operations_user_portfolio_time_idx
on public.cash_operations(user_id, portfolio_id, occurred_at desc);

create index if not exists holdings_snapshot_latest_idx
on public.holdings_snapshot(user_id, portfolio_id, snapshot_at desc);

create index if not exists broker_account_snapshots_latest_idx
on public.broker_account_snapshots(user_id, portfolio_id, broker_account_id, snapshot_at desc);

create unique index if not exists internal_transfers_auto_match_key
on public.internal_transfers(
  user_id,
  portfolio_id,
  from_broker_account_id,
  to_broker_account_id,
  occurred_at
)
where occurred_at is not null;

alter table public.position_lots enable row level security;
alter table public.cash_operations enable row level security;
alter table public.holdings_snapshot enable row level security;
alter table public.broker_account_snapshots enable row level security;

drop trigger if exists set_position_lots_updated_at on public.position_lots;
create trigger set_position_lots_updated_at
before update on public.position_lots
for each row execute function public.set_updated_at();

drop trigger if exists set_cash_operations_updated_at on public.cash_operations;
create trigger set_cash_operations_updated_at
before update on public.cash_operations
for each row execute function public.set_updated_at();

create policy "position_lots_all_own" on public.position_lots
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "cash_operations_all_own" on public.cash_operations
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "holdings_snapshot_all_own" on public.holdings_snapshot
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "broker_account_snapshots_all_own" on public.broker_account_snapshots
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
