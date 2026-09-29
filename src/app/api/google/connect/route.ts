import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiError, session } from "@/lib/server";
import { googleConfig, seal } from "@/lib/google";
export async function GET() {
  try {
    const { user } = await session();
    const config = googleConfig();
    const state = randomBytes(32).toString("hex");
    const jar = await cookies();
    jar.set("calendar_oauth", seal(JSON.stringify({ state, user: user.id })), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/api/google",
    });
    const query = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirect,
      response_type: "code",
      scope: "openid email https://www.googleapis.com/auth/calendar.events",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return NextResponse.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${query}`,
    );
  } catch (e) {
    return apiError(e);
  }
}
