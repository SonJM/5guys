"use server";
import { session } from "@/lib/server";

export type GroupPlan = {
  id: string;
  group_id: number;
  created_by: string;
  title: string;
  kind: "meetup" | "trip";
  starts_at: string;
  ends_at: string;
  status: "proposed" | "confirmed";
  place_name: string | null;
  place_url: string | null;
  group_plan_votes: { user_id: string; vote: "yes" | "maybe" | "no" }[];
};

export async function listGroupPlans(groupId: number) {
  const { db, user } = await session();
  if (!Number.isSafeInteger(groupId)) throw new Error("그룹을 선택해주세요.");
  const { data, error } = await db.from("group_plans")
    .select("id,group_id,created_by,title,kind,starts_at,ends_at,status,place_name,place_url,group_plan_votes(user_id,vote)")
    .eq("group_id", groupId).order("starts_at").limit(100);
  if (error) throw new Error("그룹 계획 DB 업데이트가 필요합니다.");
  const { data: group } = await db.from("groups").select("created_by").eq("id", groupId).maybeSingle();
  return { plans: data as GroupPlan[], isOwner: group?.created_by === user.id, currentUserId: user.id };
}

export async function createGroupPlan(groupId: number, title: string, kind: "meetup" | "trip", start: string, end: string) {
  const { db, user } = await session();
  const duration = Date.parse(end) - Date.parse(start);
  if (!Number.isSafeInteger(groupId) || !title.trim() || title.trim().length > 100 || !["meetup", "trip"].includes(kind) || !Number.isFinite(duration) || duration < 30 * 60000 || duration > 14 * 86400000)
    throw new Error("계획 제목과 30분~14일 사이의 시간을 확인해주세요.");
  const { error } = await db.from("group_plans").insert({
    group_id: groupId, created_by: user.id, title: title.trim(), kind,
    starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(),
  });
  if (error) throw new Error("그룹 계획을 저장하지 못했습니다. 그룹 권한과 DB 설정을 확인해주세요.");
}

export async function voteGroupPlan(planId: string, vote: "yes" | "maybe" | "no") {
  const { db, user } = await session();
  if (!/^[0-9a-f-]{36}$/i.test(planId) || !["yes", "maybe", "no"].includes(vote)) throw new Error("후보와 의견을 확인해주세요.");
  const { error } = await db.from("group_plan_votes").upsert({ plan_id: planId, user_id: user.id, vote });
  if (error) throw new Error("의견을 저장하지 못했습니다. 확정 전 후보인지 확인해주세요.");
}

export async function confirmGroupPlan(planId: string) {
  const { db } = await session();
  if (!/^[0-9a-f-]{36}$/i.test(planId)) throw new Error("후보를 확인해주세요.");
  const { data, error } = await db.from("group_plans").update({ status: "confirmed" })
    .eq("id", planId).eq("status", "proposed").select("id").maybeSingle();
  if (error || !data) throw new Error("그룹 생성자만 계획을 확정할 수 있습니다.");
}

export async function setGroupPlanPlace(planId: string, groupId: number, name: string, url: string) {
  const { db } = await session();
  let placeUrl: URL;
  try { placeUrl = new URL(url); }
  catch { throw new Error("장소 링크를 확인해주세요."); }
  if (!/^[0-9a-f-]{36}$/i.test(planId) || !Number.isSafeInteger(groupId) || !name.trim() || name.length > 120 || !["http:", "https:"].includes(placeUrl.protocol) || !["place.map.kakao.com", "map.kakao.com"].includes(placeUrl.hostname) || placeUrl.username || placeUrl.password || placeUrl.port || url.length > 1000)
    throw new Error("장소 정보를 확인해주세요.");
  placeUrl.protocol = "https:";
  const { data, error } = await db.from("group_plans")
    .update({ place_name: name.trim(), place_url: placeUrl.toString() })
    .eq("id", planId).eq("group_id", groupId).select("id").maybeSingle();
  if (error || !data) throw new Error("그룹 생성자만 장소를 정할 수 있습니다.");
}
