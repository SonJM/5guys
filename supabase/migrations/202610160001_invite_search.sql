-- Include accounts that have not set a profile name; preserve profile RLS.
begin;
create or replace function public.planner_search_invitable_users(
 target_group bigint, search_term text, result_offset integer default 0
)
returns table(id uuid, username text, email text)
language plpgsql stable security definer set search_path = '' as $$
declare term text := lower(btrim(search_term));
begin
 if auth.uid() is null or not exists (
  select 1 from public.groups g where g.id=target_group and g.created_by=auth.uid()
 ) then raise exception '그룹 생성자만 초대할 사용자를 검색할 수 있습니다.'; end if;
 if term is null or length(term) not between 2 and 100 then
  raise exception '검색어는 2~100자로 입력해주세요.';
 end if;
 if result_offset is null or result_offset < 0 then raise exception '검색 페이지를 확인해주세요.'; end if;
 return query
 select u.id, p.username::text, coalesce(u.email,p.email)::text
 from auth.users u left join public.profiles p on p.id=u.id
 where u.id<>auth.uid()
 and not exists (
  select 1 from public.group_members gm where gm.group_id=target_group and gm.user_id=u.id
 )
 and (strpos(lower(coalesce(p.username,'')),term)>0
      or strpos(lower(coalesce(u.email,p.email,'')),term)>0)
 order by lower(coalesce(nullif(p.username,''),u.email,p.email,'')),u.id
 limit 21 offset result_offset;
end $$;
revoke all on function public.planner_search_invitable_users(bigint,text,integer) from public, anon;
grant execute on function public.planner_search_invitable_users(bigint,text,integer) to authenticated;
commit;
