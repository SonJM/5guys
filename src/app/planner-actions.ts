"use server";
import { session } from "@/lib/server";
import {
  addDays,
  validDay,
  type PlannerEvent,
  type ShiftPattern,
} from "@/lib/planner";

export async function loadPlanner(from: string, to: string) {
  const { db, user } = await session();
  if (!validDay(from) || !validDay(to)) throw new Error("날짜를 확인해주세요.");
  const [events, patterns, legacy] = await Promise.all([
    db
      .from("planner_events")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .lt("starts_at", `${addDays(to, 1)}T00:00:00+09:00`)
      .gt("ends_at", `${from}T00:00:00+09:00`)
      .order("starts_at"),
    db
      .from("planner_patterns")
      .select("*")
      .eq("user_id", user.id)
      .order("label"),
    db
      .from("schedules")
      .select("date,status,event_title")
      .eq("user_id", user.id)
      .gte("date", from)
      .lte("date", to),
  ]);
  if (events.error || patterns.error)
    throw new Error(
      "시간 일정 기능의 DB 업데이트가 필요합니다. 관리자에게 문의해주세요.",
    );
  return {
    events: events.data as PlannerEvent[],
    patterns: patterns.data as ShiftPattern[],
    legacy: legacy.data ?? [],
  };
}
export async function loadCalendarMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('달력을 확인해주세요.');
  const { db, user } = await session();
  const first = `${month}-01`;
  const next = new Date(`${first}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const nextMonth = next.toISOString().slice(0, 10);
  const last = addDays(nextMonth, -1);
  const legacyRequest = db.from('schedules')
    .select('date,status,event_title').eq('user_id', user.id)
    .gte('date', first).lte('date', last);
  const events: PlannerEvent[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const { data, error } = await db.from('planner_events').select('*')
      .eq('user_id', user.id).is('deleted_at', null)
      .lt('starts_at', `${nextMonth}T00:00:00+09:00`)
      .gt('ends_at', `${first}T00:00:00+09:00`)
      .order('starts_at').order('id').range(offset, offset + 499);
    if (error || !data) throw new Error('달력 일정을 불러오지 못했습니다.');
    events.push(...data as PlannerEvent[]);
    if (data.length < 500) break;
    if (offset === 9500) throw new Error('한 달 일정이 너무 많아 모두 표시할 수 없습니다.');
  }
  const { data: legacy, error: legacyError } = await legacyRequest;
  if (legacyError) throw new Error('기존 일정을 불러오지 못했습니다.');
  return { month, events, legacy: legacy ?? [] };
}
export async function saveEvents(rows: Partial<PlannerEvent>[]) {
  const { db, user } = await session();
  if (!Array.isArray(rows) || !rows.length || rows.length > 366)
    throw new Error("한 번에 1~366개 일정을 저장할 수 있습니다.");
  const payload = rows.map((row) => {
    if (
      !row.title?.trim() ||
      row.title.length > 200 ||
      !row.starts_at ||
      !row.ends_at ||
      !Number.isFinite(Date.parse(row.starts_at)) ||
      !Number.isFinite(Date.parse(row.ends_at)) ||
      Date.parse(row.ends_at) <= Date.parse(row.starts_at) ||
      Date.parse(row.ends_at) - Date.parse(row.starts_at) > 366 * 86400000
    )
      throw new Error("일정 제목과 시작·종료 시간을 확인해주세요.");
    if (!["work", "appointment", "rest"].includes(row.kind ?? ""))
      throw new Error("일정 종류를 확인해주세요.");
    if (row.kind === 'work' && row.source !== 'ocr')
      throw new Error('근무 일정은 근무표 사진 분석 결과에서만 등록할 수 있습니다.');
    return {
      id: row.id ?? crypto.randomUUID(),
      user_id: user.id,
      title: row.title.trim(),
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      kind: row.kind,
      series_id: row.series_id ?? null,
      source: row.source === "ocr" ? "ocr" : "manual",
      sync_state: "pending",
      updated_at: new Date().toISOString(),
      all_day: row.all_day ?? false,
    };
  });
  const { error } = await db.rpc("planner_save_events", { payload });
  if (error)
    throw new Error(
      "일정 저장에 실패했습니다. DB 설정 또는 시간 값을 확인해주세요.",
    );
}
export async function deleteEvents(
  id: string,
  scope: "one" | "following" | "all",
) {
  const { db, user } = await session();
  const { data: event, error } = await db
    .from("planner_events")
    .select("id,series_id,starts_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error || !event) throw new Error("일정을 찾을 수 없습니다.");
  let query = db
    .from("planner_events")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_state: "pending",
    })
    .eq("user_id", user.id);
  if (scope !== "one" && event.series_id) {
    query = query.eq("series_id", event.series_id);
    if (scope === "following") query = query.gte("starts_at", event.starts_at);
  } else query = query.eq("id", id);
  const result = await query;
  if (result.error) throw new Error("일정 삭제에 실패했습니다.");
}
export async function updateSeries(
  id: string,
  title: string,
  startTime: string,
  endTime: string,
  nextDay: boolean,
  scope: "following" | "all",
) {
  const { db, user } = await session();
  const { data: event } = await db
    .from("planner_events")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!event?.series_id) throw new Error("반복 일정을 찾을 수 없습니다.");
  if (event.kind === 'work') throw new Error('근무 일정은 근무표 사진에서만 수정할 수 있습니다.');
  let query = db
    .from("planner_events")
    .select("*")
    .eq("user_id", user.id)
    .eq("series_id", event.series_id)
    .is("deleted_at", null);
  if (scope === "following") query = query.gte("starts_at", event.starts_at);
  const { data, error } = await query.limit(367);
  if (error || !data || data.length > 366)
    throw new Error("반복 일정 조회에 실패했습니다.");
  await saveEvents(
    data.map((row) => {
      const day = new Date(Date.parse(row.starts_at) + 9 * 3600000)
        .toISOString()
        .slice(0, 10);
      return {
        ...row,
        title,
        starts_at: `${day}T${startTime}:00+09:00`,
        ends_at: `${addDays(day, nextDay ? 1 : 0)}T${endTime}:00+09:00`,
      };
    }),
  );
}
export async function savePattern(pattern: Partial<ShiftPattern>) {
  const { db, user } = await session();
  if (
    !pattern.label?.trim() ||
    pattern.label.length > 40 ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(pattern.start_time ?? "") ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(pattern.end_time ?? "") ||
    ![0, 1].includes(pattern.end_day_offset ?? -1) ||
    !Array.isArray(pattern.aliases) ||
    pattern.aliases.length > 20
  )
    throw new Error("근무 이름과 시간을 확인해주세요.");
  const { error } = await db.from("planner_patterns").upsert({
    id: pattern.id ?? crypto.randomUUID(),
    user_id: user.id,
    label: pattern.label.trim(),
    aliases: pattern.aliases
      .map((a) => String(a).trim().slice(0, 40))
      .filter(Boolean),
    start_time: pattern.start_time,
    end_time: pattern.end_time,
    end_day_offset: pattern.end_day_offset,
    color: /^#[0-9a-f]{6}$/i.test(pattern.color ?? "")
      ? pattern.color
      : "#0f766e",
    is_off: !!pattern.is_off,
  });
  if (error)
    throw new Error("같은 이름의 근무가 있거나 시간 범위가 잘못되었습니다.");
}
export async function removePattern(id: string) {
  const { db, user } = await session();
  const { error } = await db
    .from("planner_patterns")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error("근무 유형 삭제에 실패했습니다.");
}
export async function availability(group: number, day: string) {
  const { db } = await session();
  if (!Number.isSafeInteger(group) || !validDay(day))
    throw new Error("그룹과 날짜를 확인해주세요.");
  const { data, error } = await db.rpc("group_availability", {
    target_group: group,
    target_day: day,
  });
  if (error)
    throw new Error(
      "그룹 가능 시간을 불러오지 못했습니다. 그룹 권한과 DB 업데이트를 확인해주세요.",
    );
  return data as {
    user_id: string;
    username: string;
    slot: string;
    available: boolean;
    confirmed: boolean;
  }[];
}

export async function availabilityMonth(group: number, from: string, to: string) {
  const { db } = await session();
  if (!Number.isSafeInteger(group) || !validDay(from) || !validDay(to) || Date.parse(to) < Date.parse(from) || Date.parse(to) - Date.parse(from) > 41 * 86400000)
    throw new Error("그룹과 달력 범위를 확인해주세요.");
  const { data, error } = await db.rpc("group_month_availability", {
    target_group: group,
    first_day: from,
    last_day: to,
  });
  if (error) throw new Error("그룹 달력 DB 업데이트가 필요합니다.");
  return data as { day: string; common_slots: number; member_count: number }[];
}

export async function availabilityRange(
  group: number,
  from: string,
  to: string,
) {
  if (
    !validDay(from) ||
    !validDay(to) ||
    Date.parse(to) < Date.parse(from) ||
    Date.parse(to) - Date.parse(from) > 13 * 86400000
  )
    throw new Error("검색 범위는 최대 14일입니다.");
  const count = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  const days = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      availability(group, addDays(from, i)),
    ),
  );
  return days.flat();
}
