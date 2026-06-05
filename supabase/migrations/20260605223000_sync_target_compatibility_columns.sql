-- Keep legacy target columns and XTB/decision compatibility columns aligned.
-- Some hosted databases may have the XTB compatibility columns but not the
-- later decision-engine columns yet. In that partial state, Strategy saves can
-- update target_allocation while target_allocation_pct remains stale at 0.

update public.targets
set target_allocation_pct = target_allocation
where target_allocation_pct is not null
  and coalesce(target_allocation_pct, 0) = 0
  and coalesce(target_allocation, 0) <> 0;

update public.targets
set max_allocation_pct = max_allocation
where max_allocation_pct is null
  and max_allocation is not null;

update public.targets
set core_pct = core_percent
where core_pct is null
  and core_percent is not null;

update public.targets
set satellite_pct = satellite_percent
where satellite_pct is null
  and satellite_percent is not null;
