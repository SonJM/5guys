import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server";
import { syncGoogle } from "@/lib/google";
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return new NextResponse(null, { status: 401 });
  const { data, error } = await adminDb()
    .from("google_connections")
    .select("user_id")
    .order("last_sync", { ascending: true, nullsFirst: true })
    .limit(10);
  if (error)
    return NextResponse.json(
      { error: "Connection lookup failed" },
      { status: 500 },
    );
  let synced = 0;
  for (const connection of data ?? []) {
    try {
      await syncGoogle(connection.user_id);
      synced++;
    } catch {}
  }
  return NextResponse.json({ synced, total: data?.length ?? 0 });
}
