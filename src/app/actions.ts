"use server";
import { session } from "@/lib/server";
import { revalidatePath } from "next/cache";
import type { VacationOption } from "@/types";

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
