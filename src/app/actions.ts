"use server";
import { session } from "@/lib/server";
import { revalidatePath } from "next/cache";
import type { VacationOption } from "@/types";

export async function searchInvitableUsersAction(groupId: number, query: string, offset = 0) {
  const term = query.trim();
  if (!Number.isSafeInteger(groupId) || groupId <= 0 || !Number.isSafeInteger(offset) || offset < 0)
    throw new Error('그룹과 검색 페이지를 확인해주세요.');
  if (term.length < 2 || term.length > 100)
    throw new Error('검색어는 2~100자로 입력해주세요.');
  const { db } = await session();
  const { data, error } = await db.rpc('planner_search_invitable_users', {
    target_group: groupId, search_term: term, result_offset: offset,
  });
  if (error) throw new Error('사용자 검색에 실패했습니다. 그룹 생성자 권한과 DB 업데이트를 확인해주세요.');
  const users = (data ?? []) as { id: string; username: string | null; email: string | null }[];
  return { users: users.slice(0, 20), hasMore: users.length > 20 };
}

export async function findBestDateAction(
  _duration: number,
  _start: string,
  _end: string,
  _group: number | null,
): Promise<{ result?: VacationOption[]; error?: string }> {
  void [_duration, _start, _end, _group];
  return {
    error: "시간 기반 그룹 가능 시간 화면에서 여행과 약속 시간을 확인해주세요.",
  };
}
export async function createGroupAction(groupName: string) {
  try {
    if (!groupName.trim() || groupName.length > 80)
      return { error: "그룹 이름은 1~80자로 입력해주세요." };
    const { db } = await session();
    const { error } = await db.rpc("planner_create_group", {
      group_name: groupName.trim(),
    });
    if (error)
      return { error: "그룹 생성에 실패했습니다. DB 업데이트를 확인해주세요." };
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
export async function inviteUserAction(
  groupId: number,
  userIdToInvite: string,
) {
  try {
    const { db, user } = await session();
    const { data: group } = await db
      .from("groups")
      .select("id")
      .eq("id", groupId)
      .eq("created_by", user.id)
      .maybeSingle();
    if (!group) return { error: "그룹 생성자만 멤버를 추가할 수 있습니다." };
    const { count } = await db
      .from("group_members")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", groupId);
    if ((count ?? 0) >= 20)
      return { error: "그룹은 최대 20명까지 추가할 수 있습니다." };
    const { error } = await db
      .from("group_members")
      .insert({ group_id: groupId, user_id: userIdToInvite });
    if (error) return { error: "이미 가입한 멤버이거나 추가 권한이 없습니다." };
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
export async function listGroupMembersAction(groupId: number) {
  const { db, user } = await session();
  if (!Number.isSafeInteger(groupId)) throw new Error('그룹을 선택해주세요.');
  const { data: membership } = await db.from('group_members').select('user_id').eq('group_id', groupId).eq('user_id', user.id).maybeSingle();
  if (!membership) throw new Error('그룹 구성원만 목록을 볼 수 있습니다.');
  const [{ data: members, error }, { data: group }] = await Promise.all([
    db.from('group_members').select('user_id').eq('group_id', groupId),
    db.from('groups').select('created_by').eq('id', groupId).maybeSingle(),
  ]);
  if (error || !members) throw new Error('구성원 목록을 불러오지 못했습니다.');
  const { data: profiles, error: profileError } = await db.from('profiles').select('id,username').in('id', members.map(member => member.user_id));
  if (profileError) throw new Error('구성원 이름을 불러오지 못했습니다.');
  return members.map(member => ({ id: member.user_id, name: profiles?.find(profile => profile.id === member.user_id)?.username || '구성원', role: member.user_id === group?.created_by ? '그룹 생성자' : '구성원' }));
}
export async function updateUsernameAction(username: string) {
  try {
    if (!username.trim() || username.length > 40)
      return { error: "이름은 1~40자로 입력해주세요." };
    const { db, user } = await session();
    const { error } = await db
      .from("profiles")
      .upsert({ id: user.id, username: username.trim(), email: user.email });
    if (error) return { error: "이름 업데이트에 실패했습니다." };
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
