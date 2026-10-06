-- Apply after 202609290001_planner.sql. Existing events and groups are preserved.
begin;

-- The argument name is part of the RPC contract. Qualify it and avoid an
-- ambiguous column reference in the conflict target.
create or replace function public.planner_rate_limit(feature text, max_calls integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if auth.uid() is null then return false; end if;
 insert into planner_rate_limits(user_id,feature,hour)
 values(auth.uid(),left(planner_rate_limit.feature,40),date_trunc('hour',now()))
 on conflict on constraint planner_rate_limits_pkey
 do update set calls=planner_rate_limits.calls+1 returning calls into n;
 return n<=least(greatest(max_calls,1),60);
end $$;

-- Availability is derived from one copy of each member's events. A change to
-- planner_events (including Google sync) is visible to every current group.
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
 not exists(select 1 from planner_events e where e.user_id=gm.user_id and e.deleted_at is null and e.starts_at<t.slot+interval '30 minutes' and e.ends_at>t.slot)
 and not exists(select 1 from group_plans gp where gp.group_id=target_group and gp.status='confirmed' and gp.starts_at<t.slot+interval '30 minutes' and gp.ends_at>t.slot), true
 from group_members gm left join profiles p on p.id=gm.user_id
 cross join generate_series(target_day::timestamp at time zone 'Asia/Seoul', (target_day+1)::timestamp at time zone 'Asia/Seoul'-interval '30 minutes', interval '30 minutes') as t(slot)
 where gm.group_id=target_group;
end $$;

create or replace function public.group_month_availability(target_group bigint, first_day date, last_day date)
returns table(day date, common_slots integer, member_count integer)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from group_members gm where gm.group_id=target_group and gm.user_id=auth.uid()) then
  raise exception '그룹 접근 권한이 없습니다.';
 end if;
 if last_day<first_day or last_day>first_day+41 then raise exception '조회 범위는 최대 42일입니다.'; end if;
 if (select count(*) from group_members gm where gm.group_id=target_group)>20 then raise exception '그룹 구성원은 최대 20명입니다.'; end if;
 return query
 with days as (select d::date as value from generate_series(first_day,last_day,interval '1 day') d),
 slots as (
  select d.value as slot_day,t.slot,
   bool_and(not exists(select 1 from planner_events e where e.user_id=gm.user_id and e.deleted_at is null and e.starts_at<t.slot+interval '30 minutes' and e.ends_at>t.slot)
    and not exists(select 1 from group_plans gp where gp.group_id=target_group and gp.status='confirmed' and gp.starts_at<t.slot+interval '30 minutes' and gp.ends_at>t.slot)) as everyone_free
  from days d
  cross join lateral generate_series(d.value::timestamp at time zone 'Asia/Seoul', (d.value+1)::timestamp at time zone 'Asia/Seoul'-interval '30 minutes', interval '30 minutes') t(slot)
  join group_members gm on gm.group_id=target_group
  group by d.value,t.slot
 )
 select d.value,coalesce(count(*) filter(where s.everyone_free),0)::integer,
  (select count(*)::integer from group_members gm where gm.group_id=target_group)
 from days d left join slots s on s.slot_day=d.value group by d.value order by d.value;
end $$;
revoke all on function public.group_month_availability(bigint,date,date) from public;
grant execute on function public.group_month_availability(bigint,date,date) to authenticated;

create table public.group_plans (
 id uuid primary key default gen_random_uuid(),
 group_id bigint not null references public.groups(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 100),
 kind text not null check(kind in ('meetup','trip')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null default 'proposed' check(status in ('proposed','confirmed')),
 place_name text,
 place_url text,
 created_at timestamptz not null default now(),
 check(ends_at>=starts_at+interval '30 minutes' and ends_at<=starts_at+interval '14 days'),
 check(place_url is null or place_url ~ '^https://')
);
create table public.group_plan_votes (
 plan_id uuid not null references public.group_plans(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 vote text not null check(vote in ('yes','maybe','no')),
 primary key(plan_id,user_id)
);
create index group_plans_group_start on public.group_plans(group_id,starts_at);
alter table public.group_plans enable row level security;
alter table public.group_plan_votes enable row level security;
grant select,insert,update,delete on public.group_plans,public.group_plan_votes to authenticated;
create policy group_plans_read on public.group_plans for select to authenticated using(public.planner_is_member(group_id));
create policy group_plans_insert on public.group_plans for insert to authenticated with check(created_by=auth.uid() and public.planner_is_member(group_id));
create policy group_plans_update on public.group_plans for update to authenticated using(
 exists(select 1 from groups g where g.id=group_id and g.created_by=auth.uid())
) with check(exists(select 1 from groups g where g.id=group_id and g.created_by=auth.uid()));
create policy group_plans_delete on public.group_plans for delete to authenticated using(created_by=auth.uid() and status='proposed');
create policy group_plan_votes_read on public.group_plan_votes for select to authenticated using(
 exists(select 1 from group_plans p where p.id=plan_id and public.planner_is_member(p.group_id))
);
create policy group_plan_votes_insert on public.group_plan_votes for insert to authenticated with check(
 user_id=auth.uid() and exists(select 1 from group_plans p where p.id=plan_id and p.status='proposed' and public.planner_is_member(p.group_id))
);
create policy group_plan_votes_update on public.group_plan_votes for update to authenticated using(
 user_id=auth.uid() and exists(select 1 from group_plans p where p.id=plan_id and p.status='proposed' and public.planner_is_member(p.group_id))
) with check(user_id=auth.uid());
create policy group_plan_votes_delete on public.group_plan_votes for delete to authenticated using(user_id=auth.uid());

commit;
