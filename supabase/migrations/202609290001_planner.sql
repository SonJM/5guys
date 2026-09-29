-- Apply in Supabase SQL Editor before deploying the new planner. Legacy rows are preserved.
begin;
create table if not exists public.planner_patterns (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 label text not null check(length(label) between 1 and 40), aliases text[] not null default '{}',
 start_time time not null, end_time time not null, end_day_offset integer not null default 0 check(end_day_offset in (0,1)),
 color text not null default '#2563eb', is_off boolean not null default false,
 unique(user_id,label), check(is_off or end_day_offset=1 or end_time>start_time)
);
create table if not exists public.planner_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 200), starts_at timestamptz not null, ends_at timestamptz not null,
 kind text not null default 'appointment' check(kind in ('work','appointment','rest')),
 source text not null default 'manual' check(source in ('manual','ocr','google')), series_id uuid,
 all_day boolean not null default false, deleted_at timestamptz,
 google_id text, google_etag text, sync_state text not null default 'pending' check(sync_state in ('pending','synced','conflict')),
 updated_at timestamptz not null default now(), check(ends_at>starts_at), unique(user_id,google_id)
);
create index if not exists planner_event_range on public.planner_events(user_id,starts_at,ends_at);
create table if not exists public.planner_coverage (
 user_id uuid not null references auth.users(id) on delete cascade, day date not null, primary key(user_id,day)
);
create table if not exists public.google_connections (
 user_id uuid primary key references auth.users(id) on delete cascade, refresh_token text not null,
 calendar_id text not null default 'primary', google_account text not null, last_sync timestamptz, locked_until timestamptz, last_error text
);
create table if not exists public.planner_rate_limits (
 user_id uuid not null references auth.users(id) on delete cascade, feature text not null, hour timestamptz not null,
 calls integer not null default 1, primary key(user_id,feature,hour)
);
alter table public.planner_patterns enable row level security;
alter table public.planner_events enable row level security;
alter table public.planner_coverage enable row level security;
alter table public.google_connections enable row level security;
alter table public.planner_rate_limits enable row level security;
grant select,insert,update,delete on public.planner_events,public.planner_patterns,public.planner_coverage to authenticated;

-- Batch insert/update is atomic and leaves Google IDs/etags intact on edits.
create or replace function public.planner_save_events(payload jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare affected integer;
begin
 if auth.uid() is null or jsonb_typeof(payload)<>'array' or jsonb_array_length(payload) not between 1 and 366 then raise exception '일정 목록을 확인해주세요.'; end if;
 insert into planner_events(id,user_id,title,starts_at,ends_at,kind,source,series_id,all_day)
 select x.id,auth.uid(),x.title,x.starts_at,x.ends_at,x.kind,x.source,x.series_id,coalesce(x.all_day,false)
 from jsonb_to_recordset(payload) as x(id uuid,title text,starts_at timestamptz,ends_at timestamptz,kind text,source text,series_id uuid,all_day boolean)
 on conflict(id) do update set
  title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,kind=excluded.kind,
  series_id=excluded.series_id,all_day=excluded.all_day,updated_at=now(),sync_state='pending'
 where planner_events.user_id=auth.uid() and planner_events.deleted_at is null;
 get diagnostics affected=row_count;
 if affected<>jsonb_array_length(payload) then raise exception '일정 중 일부를 저장하지 못했습니다.'; end if;
end $$;
revoke all on function public.planner_save_events(jsonb) from public;
grant execute on function public.planner_save_events(jsonb) to authenticated;
create policy planner_patterns_owner on public.planner_patterns for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy planner_events_owner on public.planner_events for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy planner_coverage_owner on public.planner_coverage for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on public.google_connections, public.planner_rate_limits from anon, authenticated;
grant all on public.google_connections, public.planner_rate_limits to service_role;

create or replace function public.planner_rate_limit(feature text, max_calls integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if auth.uid() is null then return false; end if;
 insert into planner_rate_limits(user_id,feature,hour) values(auth.uid(),left(feature,40),date_trunc('hour',now()))
 on conflict(user_id,feature,hour) do update set calls=planner_rate_limits.calls+1 returning calls into n;
 return n<=least(greatest(max_calls,1),60);
end $$;
revoke all on function public.planner_rate_limit(text,integer) from public;
grant execute on function public.planner_rate_limit(text,integer) to authenticated;

-- Only free intervals are returned: no titles, event IDs, employers or busy-event rows.
create or replace function public.planner_create_group(group_name text)
returns bigint language plpgsql security definer set search_path=public as $$
declare new_id bigint;
begin
 if auth.uid() is null or length(trim(group_name)) not between 1 and 80 then raise exception '그룹 이름과 로그인을 확인해주세요.'; end if;
 insert into groups(name,created_by) values(trim(group_name),auth.uid()) returning id into new_id;
 insert into group_members(group_id,user_id) values(new_id,auth.uid());
 return new_id;
end $$;
revoke all on function public.planner_create_group(text) from public;
grant execute on function public.planner_create_group(text) to authenticated;

-- Security-definer membership lookup avoids recursive RLS on group_members.
create or replace function public.planner_is_member(target_group bigint)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from group_members where group_id=target_group and user_id=auth.uid());
$$;
revoke all on function public.planner_is_member(bigint) from public;
grant execute on function public.planner_is_member(bigint) to authenticated;
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('groups','group_members') loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
create policy groups_read on public.groups for select to authenticated using(created_by=auth.uid() or public.planner_is_member(id));
create policy groups_insert on public.groups for insert to authenticated with check(created_by=auth.uid());
create policy groups_update on public.groups for update to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
create policy groups_delete on public.groups for delete to authenticated using(created_by=auth.uid());
create policy members_read on public.group_members for select to authenticated using(public.planner_is_member(group_id) or exists(select 1 from groups g where g.id=group_id and g.created_by=auth.uid()));
create policy members_insert on public.group_members for insert to authenticated with check(exists(select 1 from groups g where g.id=group_id and g.created_by=auth.uid()));
create policy members_delete on public.group_members for delete to authenticated using(user_id=auth.uid() or exists(select 1 from groups g where g.id=group_id and g.created_by=auth.uid()));

-- Import existing per-user labels without deleting or rewriting old schedule rows.
do $$ begin
 if to_regclass('public.work_patterns') is not null then
  insert into planner_patterns(user_id,label,aliases,start_time,end_time,end_day_offset,is_off)
  select user_id,left(shift_name,40),array[shift_code],coalesce(start_time::time,'00:00'::time),coalesce(end_time::time,'00:00'::time),
   case when end_time::time<=start_time::time or shift_code='휴무' then 1 else 0 end,shift_code='휴무'
  from work_patterns where length(trim(shift_name))>0 and (shift_code='휴무' or (start_time is not null and end_time is not null))
  on conflict(user_id,label) do nothing;
 end if;
end $$;

create or replace function public.group_availability(target_group bigint, target_day date)
returns table(user_id uuid, username text, slot timestamptz, available boolean, confirmed boolean)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from group_members gm where gm.group_id=target_group and gm.user_id=auth.uid()) then
  raise exception '그룹 접근 권한이 없습니다.';
 end if;
 if (select count(*) from group_members gm where gm.group_id=target_group)>20 then
  raise exception '그룹 구성원은 최대 20명까지 가능 시간을 계산할 수 있습니다.';
 end if;
 return query select gm.user_id, coalesce(p.username,'이름 없음')::text, t.slot,
 exists(select 1 from planner_coverage c where c.user_id=gm.user_id and c.day=target_day)
 and not exists(select 1 from planner_events e where e.user_id=gm.user_id and e.deleted_at is null and e.starts_at<t.slot+interval '30 minutes' and e.ends_at>t.slot),
 exists(select 1 from planner_coverage c where c.user_id=gm.user_id and c.day=target_day)
 from group_members gm left join profiles p on p.id=gm.user_id
 cross join generate_series(target_day::timestamp at time zone 'Asia/Seoul', (target_day+1)::timestamp at time zone 'Asia/Seoul'-interval '30 minutes', interval '30 minutes') as t(slot)
 where gm.group_id=target_group;
end $$;
revoke all on function public.group_availability(bigint,date) from public;
grant execute on function public.group_availability(bigint,date) to authenticated;

-- Legacy schedule detail must no longer be readable by other members.
do $$ declare p record; begin
 if to_regclass('public.schedules') is not null then
  for p in select policyname from pg_policies where schemaname='public' and tablename='schedules' loop
   execute format('drop policy %I on public.schedules',p.policyname);
  end loop;
  alter table public.schedules enable row level security;
  create policy schedules_owner_only on public.schedules for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 end if;
end $$;
commit;
