import { NextRequest, NextResponse } from "next/server";
import { apiError, session } from "@/lib/server";
// Keep Google version by reimporting. Preserve the local version as a separate, unsynced copy if requested.
export async function POST(req: NextRequest) {
  try {
    const { db, user } = await session();
    const { id, keepCopy } = await req.json();
    const { data: event, error } = await db
      .from("planner_events")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("sync_state", "conflict")
      .single();
    if (error || !event) throw new Error("충돌 일정을 찾을 수 없습니다.");
    if (keepCopy) {
      const result = await db
        .from("planner_events")
        .insert({
          user_id: user.id,
          title: `${event.title.slice(0, 180)} (내 수정본)`,
          starts_at: event.starts_at,
          ends_at: event.ends_at,
          kind: event.kind,
          source: "manual",
          sync_state: "pending",
        });
      if (result.error) throw new Error("내 수정본 저장에 실패했습니다.");
    }
    const result = await db
      .from("planner_events")
      .update({ sync_state: "synced", google_etag: null, deleted_at: null })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("updated_at", event.updated_at);
    if (result.error) throw new Error("충돌 처리에 실패했습니다.");
    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
