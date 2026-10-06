export type PlannerEvent = {
  id: string;
  user_id?: string;
  title: string;
  starts_at: string;
  ends_at: string;
  kind: "work" | "appointment" | "rest";
  source: "manual" | "ocr" | "google";
  series_id: string | null;
  deleted_at?: string | null;
  updated_at?: string;
  google_id?: string | null;
  google_etag?: string | null;
  sync_state?: string;
  all_day?: boolean;
};
export type ShiftPattern = {
  id: string;
  label: string;
  aliases: string[];
  start_time: string;
  end_time: string;
  end_day_offset: number;
  color: string;
  is_off: boolean;
};
export type AvailabilitySlot = {
  user_id: string;
  username: string;
  slot: string;
  available: boolean;
  confirmed: boolean;
};
export function commonWindows(rows: AvailabilitySlot[], hours: number) {
  if (
    !Number.isFinite(hours) ||
    hours < 0.5 ||
    hours > 336 ||
    (hours * 2) % 1 !== 0
  )
    return [];
  const users = [...new Set(rows.map((r) => r.user_id))];
  const slots = [...new Set(rows.map((r) => Date.parse(r.slot)))].sort(
    (a, b) => a - b,
  );
  const available = new Set(
    rows
      .filter((r) => r.available)
      .map((r) => `${r.user_id}:${Date.parse(r.slot)}`),
  );
  const count = hours * 2;
  return slots
    .filter(
      (start, i) =>
        i + count <= slots.length &&
        slots
          .slice(i, i + count)
          .every(
            (slot, j) =>
              slot === start + j * 1800000 &&
              users.length > 0 &&
              users.every((id) => available.has(`${id}:${slot}`)),
          ),
    )
    .map((start) => ({
      start: new Date(start).toISOString(),
      end: new Date(start + hours * 3600000).toISOString(),
    }));
}
export const KST = "+09:00";
export function dayString(value: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
export function validDay(day: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
  );
}
export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function shiftTimes(
  day: string,
  pattern: Pick<
    ShiftPattern,
    "start_time" | "end_time" | "end_day_offset" | "is_off"
  >,
) {
  const start = `${day}T${pattern.is_off ? "00:00" : pattern.start_time.slice(0, 5)}:00${KST}`;
  const end = `${addDays(day, pattern.is_off ? 1 : pattern.end_day_offset)}T${pattern.is_off ? "00:00" : pattern.end_time.slice(0, 5)}:00${KST}`;
  if (
    !validDay(day) ||
    !Number.isFinite(Date.parse(start)) ||
    !(Date.parse(end) > Date.parse(start))
  )
    throw new Error("근무 시작·종료 시간을 확인해주세요.");
  return {
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(end).toISOString(),
  };
}
export function overlaps(a: string, b: string, c: string, d: string) {
  return Date.parse(a) < Date.parse(d) && Date.parse(c) < Date.parse(b);
}
export function localInput(iso: string) {
  return new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 16);
}
export function parseOcrRows(
  value: unknown,
  year: number,
  month: number,
  patterns: ShiftPattern[],
) {
  if (!Array.isArray(value) || value.length > 62)
    throw new Error("인식 결과 형식이 올바르지 않습니다.");
  const seen = new Set<string>();
  return value.map((raw: unknown) => {
    const row = raw as {
      date?: unknown;
      label?: unknown;
      confidence?: unknown;
    };
    if (
      !row ||
      typeof row.date !== "string" ||
      !validDay(row.date) ||
      !row.date.startsWith(`${year}-${String(month).padStart(2, "0")}-`)
    )
      throw new Error("대상 월 밖의 날짜 또는 잘못된 날짜가 있습니다.");
    if (seen.has(row.date))
      throw new Error(
        `${row.date}: 중복 날짜가 있습니다. 본인 행만 선택해주세요.`,
      );
    seen.add(row.date);
    const label =
      typeof row.label === "string" ? row.label.trim().slice(0, 40) : "";
    const matches = patterns.filter((p) =>
      [p.label, ...p.aliases].some(
        (a) => a.toLowerCase() === label.toLowerCase(),
      ),
    );
    return {
      date: row.date,
      label,
      patternId: matches.length === 1 ? matches[0].id : "",
      confirmed: false,
      confidence:
        typeof row.confidence === "number"
          ? Math.max(0, Math.min(1, row.confidence))
          : 0,
    };
  });
}
