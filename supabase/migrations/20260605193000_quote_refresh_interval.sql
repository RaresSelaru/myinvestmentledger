alter table public.market_data_settings
add column if not exists quote_refresh_interval_seconds integer not null default 120
check (quote_refresh_interval_seconds between 60 and 3600);
