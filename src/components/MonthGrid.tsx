"use client";

import { addDays, dayString } from "@/lib/planner";

export function monthBounds(month: string) {
  const first = `${month}-01`;
  const last = addDays(first, new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() - 1);
  return { first, last };
}

type DayTone = "brand" | "accent" | "partial";

export default function MonthGrid({
  month,
  selectedDay,
  onSelect,
  onMonthChange,
  tone,
  description,
}: {
  month: string;
  selectedDay: string;
  onSelect: (day: string) => void;
  onMonthChange: (month: string) => void;
  tone?: (day: string) => DayTone | undefined;
  description?: (day: string) => string | undefined;
}) {
  const { first, last } = monthBounds(month);
  const weekday = new Date(`${first}T00:00:00Z`).getUTCDay();
  const start = addDays(first, -((weekday + 6) % 7));
  const count = Math.ceil((((weekday + 6) % 7) + Number(last.slice(8))) / 7) * 7;
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));
  const shiftMonth = (delta: number) => {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    onMonthChange(date.toISOString().slice(0, 7));
  };

  return (
    <div className="month-grid min-w-0" aria-label={`${month.slice(0, 4)}년 ${Number(month.slice(5))}월 달력`}>
      <div className="mb-4 flex items-center justify-between gap-2 px-1">
        <button type="button" className="calendar-month-button" aria-label="이전 달" onClick={() => shiftMonth(-1)}>‹</button>
        <strong className="text-[17px] font-extrabold tracking-tight sm:text-xl">{month.slice(0, 4)}년 {Number(month.slice(5))}월</strong>
        <button type="button" className="calendar-month-button" aria-label="다음 달" onClick={() => shiftMonth(1)}>›</button>
      </div>
      <div className="calendar-days mb-1 text-center text-[11px] font-semibold text-[var(--muted)] sm:text-xs" aria-hidden="true">
        {["월", "화", "수", "목", "금", "토", "일"].map((name) => <span key={name}>{name}</span>)}
      </div>
      <div className="calendar-days">
        {days.map((date) => {
          const selected = date === selectedDay;
          const outside = date.slice(0, 7) !== month;
          const status = tone?.(date);
          const dotColor = selected ? "bg-white" : status === "accent" ? "bg-[var(--accent)]" : status === "partial" ? "bg-amber-500" : "bg-[var(--brand)]";
          return (
            <button
              type="button"
              key={date}
              aria-label={`${date} ${description?.(date) ?? ""}`.trim()}
              aria-pressed={selected}
              onClick={() => onSelect(date)}
              className={`calendar-day ${selected ? "calendar-day-selected" : status ? "calendar-day-marked" : ""} ${outside ? "calendar-day-outside" : ""}`}
            >
              <span className={date === dayString() && !selected ? "calendar-today" : ""}>{Number(date.slice(8))}</span>
              <span className={`calendar-dot ${status ? dotColor : "bg-transparent"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
