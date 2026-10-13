import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { adminDb, session } from "@/lib/server";
import { googleConfig, seal, unseal } from "@/lib/google";
export async function GET(req: NextRequest) {
  try {
    const { user } = await session();
    const config = googleConfig();
    const jar = await cookies();
    const stored = jar.get("calendar_oauth")?.value;
    jar.set("calendar_oauth", "", { path: "/api/google", maxAge: 0 });
    if (!stored) throw new Error("연결 요청이 만료되었습니다.");
    const state = JSON.parse(unseal(stored));
    if (req.nextUrl.searchParams.has('error')) throw new Error('Calendar 연결을 취소했거나 권한을 승인하지 않았습니다. 앱 로그인은 유지됩니다.');
    const code = req.nextUrl.searchParams.get("code");
    if (
      !code ||
      state.user !== user.id ||
      state.state !== req.nextUrl.searchParams.get("state")
    )
      throw new Error("연결 확인에 실패했습니다.");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.secret,
        redirect_uri: config.redirect,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Google 연결을 완료하지 못했습니다.");
    const tokens = await response.json();
    if (
      !tokens.refresh_token ||
      !String(tokens.scope)
        .split(" ")
        .includes("https://www.googleapis.com/auth/calendar.events")
    )
      throw new Error("캘린더 접근 권한에 동의해주세요.");
    const identity = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!identity.ok) throw new Error("Google 계정을 확인하지 못했습니다.");
    const account = await identity.json();
    const loginIdentity = user.identities?.find((item) => item.provider === 'google');
    const loginAccount = loginIdentity?.identity_data?.sub ?? loginIdentity?.id;
    if (!account.sub || !loginAccount || account.sub !== loginAccount)
      throw new Error('앱에 로그인한 Google 계정으로 Calendar를 연결해주세요.');
    const db = adminDb();
    const { data: existing, error: lookupError } = await db
      .from("google_connections")
      .select("google_account")
      .eq("user_id", user.id)
      .maybeSingle();
    if (lookupError) throw new Error('기존 Calendar 연결을 확인하지 못했습니다. 다시 시도해주세요.');
    if (existing && existing.google_account !== account.sub)
      throw new Error("기존에 연결한 Google 계정으로 다시 연결해주세요.");
    const { error } = await db
      .from("google_connections")
      .upsert({
        user_id: user.id,
        refresh_token: seal(tokens.refresh_token),
        google_account: account.sub,
        calendar_id: "primary",
        last_error: null,
      });
    if (error)
      throw new Error(
        "Google 연결 저장에 실패했습니다. DB 업데이트를 확인해주세요.",
      );
    return NextResponse.redirect(
      new URL("/dashboard?calendar=connected", config.redirect),
    );
  } catch (e) {
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
    const url = new URL("/dashboard", origin);
    url.searchParams.set("calendarError", (e as Error).message);
    return NextResponse.redirect(url);
  }
}
