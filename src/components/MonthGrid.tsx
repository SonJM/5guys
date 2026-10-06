"use client";
import { addDays, dayString } from "@/lib/planner";

export function monthBounds(month: string) {
  const first = `${month}-01`;
  const last = addDays(`${month}-01`, new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() - 1);
  return { first, last };
}

export default function MonthGrid({
  month,
  selectedDay,
  onSelect,
  onMonthChange,
  badge,
}: {
  month: string;
  selectedDay: string;
  onSelect: (day: string) => void;
  onMonthChange: (month: string) => void;
  badge?: (day: string) => React.ReactNode;
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="secondary-button !min-h-10 !px-3" aria-label="이전 달" onClick={() => shiftMonth(-1)}>‹</button>
        <strong className="text-lg">{month.slice(0, 4)}년 {Number(month.slice(5))}월</strong>
        <button type="button" className="secondary-button !min-h-10 !px-3" aria-label="다음 달" onClick={() => shiftMonth(1)}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[var(--muted)]">
        {["월", "화", "수", "목", "금", "토", "일"].map((name) => <span key={name} className="py-1">{name}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => (
          <button
            type="button"
            key={date}
            aria-label={`${date} 선택`}
            aria-pressed={date === selectedDay}
            onClick={() => onSelect(date)}
            className={`flex min-h-14 flex-col items-center justify-start gap-1 rounded-xl border p-1.5 text-xs transition-colors sm:min-h-20 ${date === selectedDay ? "border-[var(--brand)] bg-[var(--brand-light)]" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-soft)]"} ${date.slice(0, 7) === month ? "" : "opacity-45"}`}
          >
            <span className={`grid size-6 place-items-center rounded-full font-bold ${date === dayString() ? "bg-[var(--brand)] text-white dark:text-[#10352e]" : ""}`}>{Number(date.slice(8))}</span>
            {badge?.(date)}
          </button>
        ))}
      </div>
    </div>
  );
}
