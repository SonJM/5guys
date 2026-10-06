"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteEvents,
  loadPlanner,
  saveEvents,
  updateSeries,
} from "@/app/planner-actions";
import {
  addDays,
  dayString,
  localInput,
  shiftTimes,
  type PlannerEvent,
  type ShiftPattern,
} from "@/lib/planner";
import MonthGrid, { monthBounds } from "@/components/MonthGrid";

export default function TimePlanner() {
  const [day, setDay] = useState(dayString());
  const [month, setMonth] = useState(dayString().slice(0, 7));
  const [monthEvents, setMonthEvents] = useState<PlannerEvent[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [legacy, setLegacy] = useState<
    { date: string; status: string; event_title: string | null }[]
  >([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState<string>();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [nextDay, setNextDay] = useState(false);
  const [kind, setKind] = useState<PlannerEvent["kind"]>("appointment");
  const [scope, setScope] = useState<"one" | "following" | "all">("one");
  const [repeat, setRepeat] = useState(1);
  const [interval, setInterval] = useState(7);
  const [cycle, setCycle] = useState("");
  const [cycleDays, setCycleDays] = useState(28);
  const requestVersion = useRef(0);
  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const data = await loadPlanner(day, day);
      if (version !== requestVersion.current) return;
      setEvents(data.events);
      setPatterns(data.patterns);
      setLegacy(data.legacy);
    } catch (e) {
      if (version !== requestVersion.current) return;
      setMessage((e as Error).message);
    }
  }, [day]);
  const reloadMonth = useCallback(async () => {
    const { first, last } = monthBounds(month);
    try {
      const data = await loadPlanner(first, last);
      setMonthEvents(data.events);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }, [month]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => { void reloadMonth(); }, [reloadMonth]);
  useEffect(() => {
    const listener = () => {
      void reload();
      void reloadMonth();
    };
    window.addEventListener("planner-synced", listener);
    return () => window.removeEventListener("planner-synced", listener);
  }, [reload, reloadMonth]);
  useEffect(() => {
    if (!editorOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setEditorOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editorOpen]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await task();
      await reload();
      await reloadMonth();
      setMessage("저장했습니다. Google 연결 시 다음 동기화에 반영됩니다.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(event: PlannerEvent) {
    setId(event.id);
    setTitle(event.title);
    setStart(localInput(event.starts_at).slice(11));
    setEnd(localInput(event.ends_at).slice(11));
    setDay(dayString(new Date(event.starts_at)));
    setMonth(dayString(new Date(event.starts_at)).slice(0, 7));
    setNextDay(
      dayString(new Date(event.starts_at)) !==
        dayString(new Date(event.ends_at)),
    );
    setKind(event.kind);
    setScope("one");
    setEditorOpen(true);
  }
  async function save() {
    if (id && scope !== "one") {
      await updateSeries(id, title, start, end, nextDay, scope);
      setId(undefined);
      setEditorOpen(false);
      return;
    }
    const count = id ? 1 : repeat;
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 52 ||
      !Number.isInteger(interval) ||
      interval < 1 ||
      interval > 31
    )
      throw new Error("반복은 1~52회, 간격은 1~31일로 입력해주세요.");
    const original = events.find((e) => e.id === id);
    if (original?.all_day)
      throw new Error(
        "Google 종일 일정은 Google Calendar에서 수정해주세요. 시간 일정은 별도로 추가할 수 있습니다.",
      );
    const series =
      original?.series_id ?? (count > 1 ? crypto.randomUUID() : null);
    await saveEvents(
      Array.from({ length: count }, (_, i) => ({
        id: i === 0 ? id : undefined,
        title,
        kind,
        series_id: series,
        ...shiftTimes(addDays(day, i * interval), {
          start_time: start,
          end_time: end,
          end_day_offset: nextDay ? 1 : 0,
          is_off: false,
        }),
      })),
    );
    setId(undefined);
    setTitle("");
    setEditorOpen(false);
  }
  async function applyCycle() {
    const labels = cycle
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (
      !labels.length ||
      !Number.isInteger(cycleDays) ||
      cycleDays < 1 ||
      cycleDays > 366
    )
      throw new Error("순환 근무와 기간(1~366일)을 확인해주세요.");
    const sequence = labels.map((label) => {
      const pattern = patterns.find((p) => p.label === label);
      if (!pattern) throw new Error(`${label}: 근무 유형을 먼저 등록해주세요.`);
      return pattern;
    });
    const series = crypto.randomUUID();
    const rows = Array.from({ length: cycleDays }, (_, i) => {
      const p = sequence[i % sequence.length];
      return { p, date: addDays(day, i) };
    })
      .filter(({ p }) => !p.is_off)
      .map(({ p, date }) => ({
        title: p.label,
        kind: "work" as const,
        series_id: series,
        ...shiftTimes(date, p),
      }));
    if (rows.length) await saveEvents(rows);
    setMessage("순환 근무를 등록했습니다. 빈 시간은 그룹 달력에 자동 반영됩니다.");
  }
  return (
    <section className="space-y-5">
      <MonthGrid month={month} selectedDay={day} onMonthChange={(next) => { setMonth(next); setDay(`${next}-01`); setId(undefined); }} onSelect={(date) => { setDay(date); setMonth(date.slice(0, 7)); setId(undefined); }} badge={(date) => {
        const count = monthEvents.filter((event) => Date.parse(event.starts_at) < Date.parse(`${addDays(date, 1)}T00:00:00+09:00`) && Date.parse(event.ends_at) > Date.parse(`${date}T00:00:00+09:00`)).length;
        return count ? <span className="rounded-full bg-[var(--accent-soft)] px-1.5 text-[10px] font-bold text-[var(--accent-ink)]">{count}건</span> : null;
      }} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface-soft)] p-3 sm:p-4">
        <div><strong>{day} 일정</strong><p className="muted text-xs">빈 시간은 소속 그룹에 자동 반영됩니다.</p></div>
        <button type="button" className="primary-button" onClick={() => { setId(undefined); setTitle(""); setEditorOpen(true); }}>+ 일정 추가</button>
      </div>
      {message && (
        <p
          role="status"
          className="status-note"
        >
          {message}
        </p>
      )}
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">하루 타임라인</h2><p className="muted mt-1 text-xs">한국 시간 기준 · 여러 일정을 등록할 수 있어요.</p></div><span className="rounded-full bg-[var(--brand-light)] px-3 py-1 text-xs font-bold text-[var(--brand)]">{events.length}개 일정</span></div>
      {events.length === 0 && <p className="empty-state text-sm"><span className="text-2xl" aria-hidden="true">◷</span>아직 이 날짜에 등록한 일정이 없어요.<span>일정 추가 버튼으로 근무 또는 약속 시간을 등록해 보세요.</span></p>}
      <div className="max-h-[430px] overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        {Array.from({ length: 24 }, (_, hour) => {
          const from = `${day}T${String(hour).padStart(2, "0")}:00:00+09:00`;
          const to = Date.parse(from) + 3600000;
          const rows = events.filter(
            (e) =>
              Date.parse(e.starts_at) < to &&
              Date.parse(e.ends_at) > Date.parse(from) &&
              (Date.parse(e.starts_at) >= Date.parse(from) || hour === 0),
          );
          return (
            <div
              key={hour}
              className="flex min-h-12 border-b border-[var(--line)] last:border-b-0"
            >
              <span className="w-16 shrink-0 border-r border-[var(--line)] bg-[var(--surface-soft)] p-2 text-xs text-[var(--muted)]">
                {String(hour).padStart(2, "0")}:00
              </span>
              <div className="flex flex-1 flex-wrap gap-1 p-1">
                {rows.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => edit(e)}
                    className={`rounded-lg border-l-[3px] px-3 py-2 text-left text-xs font-semibold ${e.kind === "work" ? "border-[#0f766e] bg-[#e4f3ef] text-[#155a53] dark:bg-[#24473e] dark:text-[#c4efdf]" : e.kind === "rest" ? "border-[#7799a2] bg-[#e8f0f1] text-[#3d6267] dark:bg-[#29434a] dark:text-[#d7eaeb]" : "border-[#e9796b] bg-[#fbe9e3] text-[#713c35] dark:bg-[#50332e] dark:text-[#fbe9e3]"}`}
                  >
                    {e.title} {localInput(e.starts_at).slice(11)}–
                    {localInput(e.ends_at).slice(11)}
                    {dayString(new Date(e.starts_at)) !==
                      dayString(new Date(e.ends_at)) && " (+1일)"}
                    {e.sync_state === "conflict" && " · Google 충돌"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {legacy.length > 0 && (
        <details className="text-sm">
          <summary>기존 날짜형 일정 {legacy.length}건 · 시간 확인 필요</summary>
          {legacy.map((e) => (
            <p key={e.date}>
              {e.date} {e.status} {e.event_title} — 아래에서 시간 일정으로
              등록해주세요.
            </p>
          ))}
        </details>
      )}
      {editorOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditorOpen(false); }}>
      <form
        id="new-event"
        role="dialog"
        aria-modal="true"
        aria-label={id ? "일정 수정" : "새 일정 추가"}
        className="planner-form max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl sm:rounded-3xl"
        onSubmit={(e) => {
          e.preventDefault();
          void run(save);
        }}
      >
        <div className="flex w-full items-center justify-between"><h3 className="text-lg font-extrabold">{day} · {id ? "일정 수정" : "새 일정 추가"}</h3><button type="button" className="ghost-button !min-h-9" aria-label="닫기" onClick={() => setEditorOpen(false)}>✕</button></div>
        <input
          aria-label="일정 제목"
          autoFocus
          required
          maxLength={200}
          placeholder="일정 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          aria-label="일정 종류"
          value={kind}
          onChange={(e) => setKind(e.target.value as PlannerEvent["kind"])}
        >
          <option value="appointment">약속</option>
          <option value="work">근무</option>
          <option value="rest">수면·휴식 (약속 불가)</option>
        </select>
        <label>
          시작{" "}
          <input
            required
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          종료{" "}
          <input
            required
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={nextDay}
            onChange={(e) => setNextDay(e.target.checked)}
          />{" "}
          다음 날 종료
        </label>
        {!id && (
          <>
            <label>
              반복 횟수{" "}
              <input
                type="number"
                min={1}
                max={52}
                value={repeat}
                onChange={(e) => setRepeat(Number(e.target.value))}
              />
            </label>
            <label>
              간격(일){" "}
              <input
                type="number"
                min={1}
                max={31}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
              />
            </label>
          </>
        )}
        {id && events.find((e) => e.id === id)?.series_id && (
          <select
            aria-label="수정 범위"
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
          >
            <option value="one">이번 일정만</option>
            <option value="following">이 일정과 이후 반복</option>
            <option value="all">전체 반복</option>
          </select>
        )}
        <button disabled={busy} className="primary-button">
          {busy ? "처리 중…" : "저장"}
        </button>
        {id && (
          <>
          <button
            type="button"
            disabled={busy}
            className="secondary-button !text-[#a54036]"
              onClick={() => {
                if (
                  confirm(
                    "선택한 범위의 일정을 삭제할까요? Google 연결 시 삭제도 반영됩니다.",
                  )
                )
                  void run(async () => {
                    await deleteEvents(id, scope);
                    setId(undefined);
                    setEditorOpen(false);
                  });
              }}
            >
              삭제
            </button>
          <button
            type="button"
            className="secondary-button"
              onClick={() => {
                setId(undefined);
                setTitle("");
              }}
            >
              취소
            </button>
          </>
        )}
      </form>
      </div>}
      <details className="rounded-2xl border border-[var(--line)] p-4 sm:p-5">
        <summary className="cursor-pointer font-bold">
          순환 교대근무 일괄 등록
        </summary>
        <div className="planner-form mt-3">
          <p className="w-full text-sm">
            근무 유형 이름을 쉼표로 입력하세요. 예: 주간, 주간, 야간, 야간,
            휴무, 휴무. 기준일은 위에서 선택한 날짜입니다.
          </p>
          <a href="/settings/work-pattern" className="brand-link">
            근무 유형 설정 →
          </a>
          <input
            aria-label="순환 패턴"
            value={cycle}
            placeholder="주간,야간,휴무"
            onChange={(e) => setCycle(e.target.value)}
          />
          <label>
            등록 일수{" "}
            <input
              type="number"
              min={1}
              max={366}
              value={cycleDays}
              onChange={(e) => setCycleDays(Number(e.target.value))}
            />
          </label>
          <button
            disabled={busy}
            onClick={() => void run(applyCycle)}
            className="primary-button"
          >
            순환 일정 추가
          </button>
        </div>
      </details>
    </section>
  );
}
