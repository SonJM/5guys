import { NextResponse } from "next/server";
import { adminDb, apiError, limited, session } from "@/lib/server";
import { ensureGoogleWatch, syncGoogle } from "@/lib/google";
import { after } from 'next/server';
export const maxDuration = 300;
export async function GET() {
  try {
    const { user } = await session();
    const { data, error } = await adminDb()
      .from("google_connections")
      .select("last_sync,last_error")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error("Google 연결 DB 업데이트가 필요합니다.");
    return NextResponse.json({ connected: !!data, ...data });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST() {
  try {
    const { user, db } = await session();
    await limited(db, "google-sync", 60);
    const result = await syncGoogle(user.id);
    after(async () => { try { await ensureGoogleWatch(user.id); } catch { /* daily recovery retries */ } });
    return NextResponse.json(result);
  } catch (e) {
    return apiError(e);
  }
}
