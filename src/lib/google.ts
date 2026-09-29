import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { adminDb } from "@/lib/server";
import { addDays, dayString, type PlannerEvent } from "@/lib/planner";
function encryptionKey() {
  const key = Buffer.from(
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? "",
    "base64",
  );
  if (key.length !== 32)
    throw new Error("Google 토큰 암호화 설정이 필요합니다.");
  return key;
}
export function seal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function unseal(value: string) {
  const data = Buffer.from(value, "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    data.subarray(0, 12),
  );
  cipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([
    cipher.update(data.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!clientId || !secret || !origin)
    throw new Error("Google Calendar 서버 연결 설정이 필요합니다.");
  return {
    clientId,
    secret,
    redirect: `${origin.replace(/\/$/, "")}/api/google/callback`,
  };
}
type GoogleEvent = {
  id: string;
  summary?: string;
  status?: string;
  etag: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  transparency?: string;
};
export async function syncGoogle(userId: string) {
  const db = adminDb();
  const config = googleConfig();
  const now = new Date().toISOString();
  const { data: connection, error: lockError } = await db
    .from("google_connections")
    .update({ locked_until: new Date(Date.now() + 300000).toISOString() })
    .eq("user_id", userId)
    .or(`locked_until.is.null,locked_until.lt.${now}`)
    .select("*")
    .maybeSingle();
  if (lockError) throw new Error("Google 연결 정보를 읽지 못했습니다.");
  if (!connection)
    throw new Error(
      "Google을 연결하거나 진행 중인 동기화가 끝난 뒤 다시 시도해주세요.",
    );
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.secret,
        refresh_token: unseal(connection.refresh_token),
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!tokenResponse.ok)
      throw new Error("Google 권한이 만료되었습니다. 다시 연결해주세요.");
    const { access_token } = await tokenResponse.json();
    async function api(path: string, init?: RequestInit) {
      return fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events${path}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
            ...init?.headers,
          },
          signal: AbortSignal.timeout(15000),
        },
      );
    }
    const from = `${addDays(dayString(), -90)}T00:00:00+09:00`;
    const to = `${addDays(dayString(), 366)}T00:00:00+09:00`;
    const remote: GoogleEvent[] = [];
    let page = "";
    let complete = false;
    for (let i = 0; i < 20; i++) {
      const query = new URLSearchParams({
        timeMin: from,
        timeMax: to,
        singleEvents: "true",
        showDeleted: "true",
        maxResults: "2500",
        ...(page ? { pageToken: page } : {}),
      });
      const response = await api(`?${query}`);
      if (!response.ok)
        throw new Error(
          "Google 일정을 읽지 못했습니다. Calendar 접근 권한을 확인해주세요.",
        );
      const data = await response.json();
      remote.push(...(data.items ?? []));
      page = data.nextPageToken;
      if (!page) {
        complete = true;
        break;
      }
    }
    if (!complete)
      throw new Error(
        "동기화할 일정이 너무 많습니다. 캘린더의 반복 범위를 줄여주세요.",
      );
    const localRows: PlannerEvent[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from('planner_events').select('*').eq('user_id', userId).order('id').range(offset, offset + 499);
      if (error || !data || offset >= 10000) throw new Error('일정 조회 범위를 초과했거나 DB 조회에 실패했습니다.');
      localRows.push(...data as PlannerEvent[]);
      if (data.length < 500) break;
    }
    const byGoogle = new Map(
      localRows.filter((e) => e.google_id).map((e) => [e.google_id, e]),
    );
    let imported = 0,
      exported = 0,
      conflicts = 0;
    async function checked(result: { error: unknown }) {
      if (result.error)
        throw new Error("동기화 결과 저장에 실패했습니다. 다시 시도해주세요.");
    }
    const seen = new Set(remote.map((e) => e.id));
    const conflicted = new Set<string>();
    for (const event of remote) {
      // Recover an interrupted insert without importing our own event a second time.
      if (
        localRows.some(
          (e) => !e.google_id && `fg${e.id.replace(/-/g, "")}` === event.id,
        )
      )
        continue;
      const own = byGoogle.get(event.id);
      if (
        own?.sync_state !== "synced" &&
        own &&
        own.google_etag !== event.etag
      ) {
        await checked(
          await db
            .from("planner_events")
            .update({ sync_state: "conflict" })
            .eq("id", own.id)
            .eq("updated_at", own.updated_at!),
        );
        conflicts++;
        conflicted.add(own.id);
        continue;
      }
      if (own && own.sync_state !== "synced") continue;
      if (
        event.status === "cancelled" ||
        event.transparency === "transparent"
      ) {
        if (own)
          await checked(
            await db
              .from("planner_events")
              .update({
                deleted_at: now,
                google_etag: event.etag,
                sync_state: "synced",
              })
              .eq("id", own.id)
              .eq("updated_at", own.updated_at!),
          );
        continue;
      }
      const starts =
        event.start?.dateTime ??
        (event.start?.date ? `${event.start.date}T00:00:00+09:00` : null);
      const ends =
        event.end?.dateTime ??
        (event.end?.date ? `${event.end.date}T00:00:00+09:00` : null);
      if (!starts || !ends) continue;
      const values = {
        title: (event.summary || "Google 일정").slice(0, 200),
        starts_at: starts,
        ends_at: ends,
        all_day: !!event.start?.date,
        google_etag: event.etag,
        sync_state: "synced",
        deleted_at: null,
        updated_at: now,
      };
      if (own) {
        if (own.google_etag === event.etag) continue;
        await checked(
          await db
            .from("planner_events")
            .update(values)
            .eq("id", own.id)
            .eq("updated_at", own.updated_at!),
        );
      } else
        await checked(
          await db
            .from("planner_events")
            .insert({
              ...values,
              user_id: userId,
              google_id: event.id,
              source: "google",
              kind: "appointment",
            }),
        );
      imported++;
    }
    // Expanded recurring instances removed or moved out of the window must not remain as stale busy time.
    for (const event of localRows.filter(
      (e) =>
        e.google_id &&
        e.sync_state === "synced" &&
        !e.deleted_at &&
        Date.parse(e.starts_at) < Date.parse(to) &&
        Date.parse(e.ends_at) > Date.parse(from) &&
        !seen.has(e.google_id!),
    )) {
      const response = await api(`/${encodeURIComponent(event.google_id!)}`);
      if (response.status === 404 || response.status === 410)
        await checked(
          await db
            .from("planner_events")
            .update({ deleted_at: now })
            .eq("id", event.id)
            .eq("updated_at", event.updated_at!),
        );
      else if (response.ok) {
        const moved: GoogleEvent = await response.json();
        if (moved.status === "cancelled")
          await checked(
            await db
              .from("planner_events")
              .update({ deleted_at: now })
              .eq("id", event.id)
              .eq("updated_at", event.updated_at!),
          );
        else if (moved.start?.dateTime && moved.end?.dateTime)
          await checked(
            await db
              .from("planner_events")
              .update({
                starts_at: moved.start.dateTime,
                ends_at: moved.end.dateTime,
                google_etag: moved.etag,
              })
              .eq("id", event.id)
              .eq("updated_at", event.updated_at!),
          );
      }
    }
    for (const event of localRows.filter(
      (e) => e.sync_state === "pending" && !conflicted.has(e.id),
    )) {
      if (event.deleted_at && !event.google_id) {
        await checked(
          await db
            .from("planner_events")
            .update({ sync_state: "synced" })
            .eq("id", event.id)
            .eq("updated_at", event.updated_at!),
        );
        continue;
      }
      const googleId = event.google_id || `fg${event.id.replace(/-/g, "")}`;
      const path = event.google_id ? `/${encodeURIComponent(googleId)}` : "";
      const body = {
        summary: event.title,
        start: event.all_day
          ? { date: dayString(new Date(event.starts_at)) }
          : { dateTime: event.starts_at, timeZone: "Asia/Seoul" },
        end: event.all_day
          ? { date: dayString(new Date(event.ends_at)) }
          : { dateTime: event.ends_at, timeZone: "Asia/Seoul" },
        ...(!event.google_id ? { id: googleId } : {}),
      };
      let response = await api(path, {
        method: event.deleted_at
          ? "DELETE"
          : event.google_id
            ? "PATCH"
            : "POST",
        headers: event.google_etag ? { "If-Match": event.google_etag } : {},
        ...(!event.deleted_at ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status === 409 && !event.google_id) {
        const current = await api(`/${googleId}`);
        if (!current.ok)
          throw new Error("이전 동기화 결과를 확인하지 못했습니다.");
        const existing = await current.json();
        response = await api(`/${googleId}`, {
          method: "PATCH",
          headers: { "If-Match": existing.etag },
          body: JSON.stringify(body),
        });
      }
      if (
        response.status === 412 ||
        (!event.deleted_at &&
          (response.status === 404 || response.status === 410))
      ) {
        await checked(
          await db
            .from("planner_events")
            .update({ sync_state: "conflict" })
            .eq("id", event.id)
            .eq("updated_at", event.updated_at!),
        );
        conflicts++;
        continue;
      }
      if (
        !response.ok &&
        !(event.deleted_at && [404, 410].includes(response.status))
      )
        throw new Error(
          "Google 일정 반영에 실패했습니다. 저장된 일정은 유지되며 다시 동기화할 수 있습니다.",
        );
      const saved = event.deleted_at ? null : await response.json();
      await checked(
        await db
          .from("planner_events")
          .update({
            google_id: googleId,
            google_etag: saved?.etag ?? event.google_etag,
            sync_state: "synced",
          })
          .eq("id", event.id)
          .eq("updated_at", event.updated_at!),
      );
      exported++;
    }
    await checked(
      await db
        .from("google_connections")
        .update({ last_sync: now, last_error: null })
        .eq("user_id", userId),
    );
    return { imported, exported, conflicts };
  } catch (e) {
    await db
      .from("google_connections")
      .update({ last_error: (e as Error).message })
      .eq("user_id", userId);
    throw e;
  } finally {
    await db
      .from("google_connections")
      .update({ locked_until: null })
      .eq("user_id", userId);
  }
}
