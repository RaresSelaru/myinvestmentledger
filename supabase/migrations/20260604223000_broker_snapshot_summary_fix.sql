alter table public.transactions
  add column if not exists realized_pl numeric;

create unique index if not exists broker_account_snapshots_import_key
on public.broker_account_snapshots(user_id, broker_account_id, imported_file_id);

update public.transactions
set realized_pl = substring(comment from 'Gross P/L[[:space:]]+(-?[0-9]+(?:\.[0-9]+)?)')::numeric
where realized_pl is null
  and coalesce(source_type, source::text) = 'xtb_import'
  and comment ~ 'Gross P/L[[:space:]]+-?[0-9]+(?:\.[0-9]+)?';

with realized as (
  select
    user_id,
    portfolio_id,
    upper(symbol) as symbol,
    sum(realized_pl) as realized_pl
  from public.transactions
  where realized_pl is not null
    and symbol is not null
  group by user_id, portfolio_id, upper(symbol)
)
update public.holdings holding
set realized_pl = realized.realized_pl
from realized
where holding.user_id = realized.user_id
  and holding.portfolio_id = realized.portfolio_id
  and upper(holding.symbol) = realized.symbol;

insert into public.broker_account_snapshots (
  user_id,
  portfolio_id,
  broker_account_id,
  imported_file_id,
  balance,
  equity,
  margin,
  free_margin,
  margin_level,
  currency,
  snapshot_at
)
select
  imported.user_id,
  imported.portfolio_id,
  imported.broker_account_id,
  imported.id,
  round(coalesce(sum(cash.amount), 0), 2) as balance,
  null as equity,
  null as margin,
  round(coalesce(sum(cash.amount), 0), 2) as free_margin,
  null as margin_level,
  coalesce(imported.account_currency, 'RON') as currency,
  coalesce(imported.imported_at, imported.created_at, now()) as snapshot_at
from public.imported_files imported
left join public.cash_operations cash
  on cash.imported_file_id = imported.id
where imported.status = 'succeeded'
group by
  imported.user_id,
  imported.portfolio_id,
  imported.broker_account_id,
  imported.id,
  imported.account_currency,
  imported.imported_at,
  imported.created_at
on conflict (user_id, broker_account_id, imported_file_id)
do update set
  balance = excluded.balance,
  free_margin = excluded.free_margin,
  currency = excluded.currency,
  snapshot_at = excluded.snapshot_at;
