alter table public.portfolios
  add column if not exists tags text[] not null default '{}';

drop index if exists public.transactions_source_fingerprint_key;

create unique index if not exists transactions_source_fingerprint_key
on public.transactions(user_id, broker_account_id, source_fingerprint);

create table if not exists public.staged_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  broker_account_id uuid not null references public.broker_accounts(id) on delete cascade,
  file_name text not null,
  file_hash text not null,
  storage_bucket text not null default 'broker-reports',
  storage_path text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  dry_run_stats jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  status text not null default 'staged' check (status in ('staged', 'imported', 'failed', 'expired')),
  error_message text,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staged_imports_user_status_idx
on public.staged_imports(user_id, status, expires_at desc);

alter table public.staged_imports enable row level security;

create policy "staged_imports_all_own" on public.staged_imports
for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop trigger if exists set_staged_imports_updated_at on public.staged_imports;
create trigger set_staged_imports_updated_at
before update on public.staged_imports
for each row execute function public.set_updated_at();

update public.imported_files imported
set status = 'failed',
    result = coalesce(imported.result, '{}'::jsonb) || jsonb_build_object(
      'status', 'failed',
      'error', 'Import stopped before normalized rows were written'
    ),
    import_stats = coalesce(imported.import_stats, '{}'::jsonb) || jsonb_build_object(
      'status', 'failed',
      'error', 'Import stopped before normalized rows were written'
    )
where imported.status = 'succeeded'
  and coalesce((imported.import_stats->>'parsedRows')::integer, 0) > 0
  and exists (
    select 1
    from public.raw_import_rows raw
    where raw.imported_file_id = imported.id
  )
  and not exists (
    select 1
    from public.transactions tx
    where tx.imported_file_id = imported.id
  )
  and not exists (
    select 1
    from public.position_lots lot
    where lot.imported_file_id = imported.id
  )
  and not exists (
    select 1
    from public.cash_operations cash
    where cash.imported_file_id = imported.id
  );
