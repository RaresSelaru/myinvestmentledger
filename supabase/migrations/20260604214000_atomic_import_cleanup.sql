alter table public.raw_import_rows
  drop constraint if exists raw_import_rows_user_id_imported_file_id_source_row_number_key;

create unique index if not exists raw_import_rows_user_file_sheet_row_key
on public.raw_import_rows(user_id, imported_file_id, sheet_name, row_number)
where sheet_name is not null and row_number is not null;

do $$
declare
  failed_import_ids uuid[];
begin
  select coalesce(array_agg(id), '{}')
  into failed_import_ids
  from public.imported_files
  where status = 'failed'
     or result->>'status' = 'failed'
     or import_stats->>'status' = 'failed';

  if coalesce(array_length(failed_import_ids, 1), 0) > 0 then
    delete from public.holdings_snapshot
    where imported_file_id = any(failed_import_ids);

    delete from public.transactions
    where imported_file_id = any(failed_import_ids)
      and coalesce(source_type, source::text) = 'xtb_import';

    delete from public.position_lots
    where imported_file_id = any(failed_import_ids);

    delete from public.cash_operations
    where imported_file_id = any(failed_import_ids);

    delete from public.raw_import_rows
    where imported_file_id = any(failed_import_ids);

    update public.imported_files
    set status = 'failed',
        result = coalesce(result, '{}'::jsonb) || jsonb_build_object(
          'status', 'failed',
          'error', 'Rolled back partial failed import'
        ),
        import_stats = coalesce(import_stats, '{}'::jsonb) || jsonb_build_object(
          'status', 'failed',
          'error', 'Rolled back partial failed import'
        )
    where id = any(failed_import_ids);
  end if;
end $$;
