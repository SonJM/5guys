-- Only private planner_events are published. Existing owner-only RLS remains in force.
-- Soft deletion is an UPDATE, so clients can invalidate deleted events as well.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'planner_events') then
    alter publication supabase_realtime add table public.planner_events;
  end if;
end;
$$;
