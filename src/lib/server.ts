import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function session() {
  const db = createClient(await cookies());
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  return { db, user };
}
export function adminDb() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("서버 연동 설정이 필요합니다.");
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function apiError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.";
  return NextResponse.json(
    { error: message },
    { status: message === "로그인이 필요합니다." ? 401 : 400 },
  );
}
export async function limited(
  db: Awaited<ReturnType<typeof session>>["db"],
  feature: string,
  limit = 20,
) {
  const { data, error } = await db.rpc("planner_rate_limit", {
    feature,
    max_calls: limit,
  });
  if (error)
    throw new Error(
      "서비스 DB 업데이트가 필요합니다. 관리자에게 문의해주세요.",
    );
  if (!data) throw new Error("요청이 많습니다. 잠시 후 다시 시도해주세요.");
}
