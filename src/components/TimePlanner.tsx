"use client";
import { useEffect, useRef, useState } from "react";
import {
  deleteEvents,
  saveEvents,
  updateSeries,
} from "@/app/planner-actions";
import type { loadCalendarMonth } from "@/app/planner-actions";
import {
  addDays,
  dayString,
  localInput,
  recurringDays,
  shiftDisplayColor,
  shiftTimes,
  type PlannerEvent,
} from "@/lib/planner";
import MonthGrid from "@/components/MonthGrid";
import { adjacentMonths, MonthCache } from "@/lib/month-cache";

type MonthData = Awaited<ReturnType<typeof loadCalendarMonth>>;

async function fetchMonth(month: string): Promise<MonthData> {
  const response = await fetch(`/api/calendar/month?${new URLSearchParams({ month })}`, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '달력 일정을 불러오지 못했습니다.');
  return data;
}

export default function TimePlanner() {
  const [day, setDay] = useState(dayString());
  const [month, setMonth] = useState(dayString().slice(0, 7));
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(true);
  const [revision, setRevision] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState<PlannerEvent | null>(null);
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
  const [frequency, setFrequency] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [interval, setInterval] = useState(1);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const requestVersion = useRef(0);
  const monthCache = useRef(new MonthCache<MonthData>());
  useEffect(() => {
    const requestCounter = requestVersion;
    const version = ++requestCounter.current;
    const cached = monthCache.current.peek(month);
    setMonthData(cached ?? null);
    setLoadingMonth(!cached);
    let prefetch: number | undefined;
    void monthCache.current.load(month, fetchMonth).then((data) => {
      if (version !== requestCounter.current || !data) return;
      setMonthData(data);
      prefetch = window.setTimeout(() => {
        if (version !== requestCounter.current || document.visibilityState !== 'visible') return;
        const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
        if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType ?? '')) return;
        for (const adjacent of adjacentMonths(month)) void monthCache.current.load(adjacent, fetchMonth).catch(() => {});
      }, 300);
    }).catch((error) => {
      if (version === requestCounter.current) setMessage((error as Error).message);
    }).finally(() => {
      if (version === requestCounter.current) setLoadingMonth(false);
    });
    return () => { if (prefetch !== undefined) window.clearTimeout(prefetch); if (requestCounter.current === version) requestCounter.current++; };
  }, [month, revision]);
  useEffect(() => {
    const listener = () => {
      monthCache.current.invalidate();
      setRevision((value) => value + 1);
    };
    window.addEventListener("planner-synced", listener);
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('planner-refresh', refresh);
    const onVisible = () => { if (document.visibilityState === 'visible') setRevision((value) => value + 1); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener("planner-synced", listener); window.removeEventListener('planner-refresh', refresh); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  useEffect(() => {
    if (!editorOpen && !detailsEvent) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setEditorOpen(false); setDetailsEvent(null); } };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editorOpen, detailsEvent]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await task();
      monthCache.current.invalidate();
      setRevision((value) => value + 1);
      window.dispatchEvent(new Event('planner-local-change'));
      setMessage("저장했습니다.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(event: PlannerEvent) {
    if (event.kind === 'work') {
      setMessage('근무는 근무표 사진에서 가져옵니다. 잘못 인식된 경우 근무표를 다시 확인해주세요.');
      return;
    }
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
    const days = id ? [day] : recurringDays(day, frequency, interval, repeat, weekdays);
    const original = events.find((e) => e.id === id);
    if (original?.all_day)
      throw new Error(
        "가져온 종일 일정은 원본 달력에서 수정해주세요. 시간 일정은 별도로 추가할 수 있습니다.",
      );
    const series =
      original?.series_id ?? (days.length > 1 ? crypto.randomUUID() : null);
    await saveEvents(
      days.map((date, i) => ({
        id: i === 0 ? id : undefined,
        title,
        kind,
        series_id: series,
        ...shiftTimes(date, {
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
  const selectedLabel = new Date(`${day}T00:00:00+09:00`).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long",
  });
  const monthEvents = monthData?.month === month ? monthData.events : [];
  const patterns = monthData?.month === month ? monthData.patterns : [];
  const workColor = (event: PlannerEvent) => {
    const pattern = patterns.find((item) => item.label === event.title);
    return pattern ? shiftDisplayColor(pattern, patterns) : undefined;
  };
  const events = monthEvents.filter((event) =>
    Date.parse(event.starts_at) < Date.parse(`${addDays(day, 1)}T00:00:00+09:00`) &&
    Date.parse(event.ends_at) > Date.parse(`${day}T00:00:00+09:00`)
  );
  const legacy = monthData?.month === month ? monthData.legacy.filter((event) => event.date === day) : [];
  const sortedEvents = [...events].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const eventSummary = (date: string) => monthEvents.filter((event) =>
    Date.parse(event.starts_at) < Date.parse(`${addDays(date, 1)}T00:00:00+09:00`) &&
    Date.parse(event.ends_at) > Date.parse(`${date}T00:00:00+09:00`)
  );
  const period = (event: PlannerEvent) => {
    const from = localInput(event.starts_at);
    const to = localInput(event.ends_at);
    if (event.all_day) {
      const last = addDays(to.slice(0, 10), -1);
      return `${from.slice(0, 10)}${last !== from.slice(0, 10) ? ` ~ ${last}` : ''} · 종일`;
    }
    return from.slice(0, 10) === to.slice(0, 10) ? `${from.slice(11)}–${to.slice(11)}` : `${from.replace('T', ' ')} ~ ${to.replace('T', ' ')}`;
  };
  const supportsEdit = detailsEvent && detailsEvent.kind !== 'work' && !detailsEvent.all_day &&
    Date.parse(`${localInput(detailsEvent.ends_at).slice(0, 10)}T00:00:00Z`) - Date.parse(`${localInput(detailsEvent.starts_at).slice(0, 10)}T00:00:00Z`) <= 86400000;
  return (
    <section className="space-y-4 sm:space-y-5">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,1fr)]">
        <div className="min-w-0 px-1 py-2 sm:rounded-3xl sm:border sm:border-[var(--line)] sm:bg-[var(--surface)] sm:p-5 xl:p-6">
          <MonthGrid month={month} selectedDay={day} onMonthChange={(next) => { setMonth(next); setDay(`${next}-01`); setId(undefined); }} onSelect={(date) => { setDay(date); setMonth(date.slice(0, 7)); setId(undefined); }} tone={(date) => {
            const items = eventSummary(date);
            return items.some((event) => event.kind === "appointment") ? "accent" : items.length ? "brand" : undefined;
          }} marker={(date) => {
            const work = eventSummary(date).find((event) => event.kind === "work" && dayString(new Date(event.starts_at)) === date);
            return work ? { label: work.title, color: workColor(work) ?? "#0f766e" } : undefined;
          }} description={(date) => `${eventSummary(date).length}개 일정`} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-[11px] font-semibold text-[var(--muted)]">
            {patterns.filter((pattern) => !pattern.is_off).map((pattern) => <span key={pattern.id}><span style={{ color: shiftDisplayColor(pattern, patterns) }}>●</span> {pattern.label}</span>)}
            <span><span className="text-[var(--accent)]">●</span> 약속</span>
            <span>○ 빈 시간</span>
          </div>
          <p className="muted mt-4 hidden rounded-xl bg-[var(--brand-light)] px-4 py-3 text-xs text-[var(--brand)] sm:block">그룹에는 일정 제목 대신 가능한 시간만 자동으로 공유돼요.</p>
        </div>
        <div className="min-w-0 space-y-3 px-1 sm:rounded-3xl sm:border sm:border-[var(--line)] sm:bg-[var(--surface)] sm:p-5 xl:p-6">
          <div className="flex items-start justify-between gap-2">
            <div><h2 className="text-base font-extrabold sm:text-lg">{selectedLabel}</h2><p className="muted mt-1 text-xs">{loadingMonth ? '일정을 불러오는 중…' : `선택한 날의 일정 ${events.length}개`}</p></div>
            <button type="button" className="text-sm font-extrabold text-[var(--brand)] sm:hidden" onClick={() => { setId(undefined); setTitle(""); setEditorOpen(true); }}>+ 일정</button>
          </div>
          {sortedEvents.length ? sortedEvents.map((event) => (
            <button key={event.id} type="button" onClick={() => setDetailsEvent(event)} className="flex w-full items-center gap-3 rounded-2xl bg-[var(--surface)] px-4 py-3 text-left shadow-sm ring-1 ring-[var(--line)] transition-transform active:scale-[.98] sm:bg-[var(--surface-soft)] sm:shadow-none">
              <span className={`h-9 w-1 shrink-0 rounded-full ${event.kind === "appointment" ? "bg-[var(--accent)]" : event.kind === "work" ? "bg-[var(--brand)]" : "bg-slate-400"}`} style={event.kind === "work" ? { backgroundColor: workColor(event) } : undefined} aria-hidden="true" />
              <span className="min-w-0"><span className="block truncate text-sm font-bold">{event.title}</span><span className="muted mt-0.5 block text-xs">{period(event)}{event.sync_state === "conflict" && " · 변경 충돌"}</span></span>
            </button>
          )) : loadingMonth ? <p role="status" className="rounded-2xl bg-[var(--surface-soft)] px-4 py-6 text-center text-sm text-[var(--muted)]">일정을 불러오는 중이에요…</p> : <p className="rounded-2xl bg-[var(--surface-soft)] px-4 py-6 text-center text-sm text-[var(--muted)]">이날은 등록된 일정이 없어요.<br />새 일정을 추가하거나 빈 시간으로 활용해 보세요.</p>}
          <button type="button" className="primary-button hidden w-full sm:inline-flex" onClick={() => { setId(undefined); setTitle(""); setEditorOpen(true); }}>+ 새 일정</button>
          <p className="muted text-xs sm:hidden">빈 시간은 소속 그룹에 자동 반영됩니다.</p>
        </div>
      </div>
      {message && (
        <p
          role="status"
          className="status-note"
        >
          {message}
        </p>
      )}
      <details className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <summary className="cursor-pointer text-sm font-bold">시간별 타임라인 보기</summary>
        <p className="muted mt-2 text-xs">한국 시간 기준 · 일정을 눌러 자세히 볼 수 있어요.</p>
      <div className="mt-4 max-h-[430px] overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
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
                    onClick={() => setDetailsEvent(e)}
                    className={`rounded-lg border-l-[3px] px-3 py-2 text-left text-xs font-semibold ${e.kind === "work" ? "border-[#0f766e] bg-[#e4f3ef] text-[#155a53] dark:bg-[#24473e] dark:text-[#c4efdf]" : e.kind === "rest" ? "border-[#7799a2] bg-[#e8f0f1] text-[#3d6267] dark:bg-[#29434a] dark:text-[#d7eaeb]" : "border-[#e9796b] bg-[#fbe9e3] text-[#713c35] dark:bg-[#50332e] dark:text-[#fbe9e3]"}`}
                  >
                    {e.title} {period(e)}
                    {e.sync_state === "conflict" && " · 변경 충돌"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </details>
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
      {detailsEvent && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsEvent(null); }}>
        <div role="dialog" aria-modal="true" aria-label="일정 상세" className="w-full max-w-lg space-y-4 rounded-t-3xl bg-[var(--surface)] p-5 sm:rounded-3xl">
          <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-extrabold">{detailsEvent.title}</h3><button type="button" className="ghost-button" aria-label="상세 닫기" onClick={() => setDetailsEvent(null)}>✕</button></div>
          <p className="muted text-xs">조회 중인 날짜: {day}</p>
          <p className="text-sm">{detailsEvent.all_day ? period(detailsEvent) : `${localInput(detailsEvent.starts_at).replace('T', ' ')} ~ ${localInput(detailsEvent.ends_at).replace('T', ' ')}`}</p>
          <p className="muted text-xs">{detailsEvent.source === 'google' ? '외부 캘린더에서 가져온 일정' : detailsEvent.source === 'ocr' ? '근무표 사진에서 등록한 일정' : '앱에서 등록한 일정'}{detailsEvent.series_id && ' · 반복 일정'}</p>
          {supportsEdit ? <button type="button" className="primary-button" onClick={() => { edit(detailsEvent); setDetailsEvent(null); }}>일정 수정</button>
            : <p className="muted text-sm">{detailsEvent.kind === 'work' ? '근무는 사진 분석 결과에서 등록합니다.' : '종일·여러 날 일정의 기간 수정은 아직 지원하지 않습니다. 가져온 일정은 원본 캘린더에서 수정할 수 있어요.'}</p>}
        </div>
      </div>}
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
            <label>반복
              <select aria-label="반복 주기" value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
                <option value="none">반복 안 함</option>
                <option value="daily">매일</option>
                <option value="weekly">매주</option>
                <option value="monthly">매월 같은 날짜</option>
              </select>
            </label>
            {frequency === 'weekly' && <fieldset className="w-full"><legend className="text-sm">반복 요일</legend><div className="flex flex-wrap gap-2">{['일','월','화','수','목','금','토'].map((label, index) => <label key={label} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={weekdays.includes(index)} onChange={(e) => setWeekdays(e.target.checked ? [...weekdays, index] : weekdays.filter((day) => day !== index))} />{label}</label>)}</div></fieldset>}
            {frequency !== 'none' && <>
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
              반복 간격{" "}
              <input
                type="number"
                min={1}
                max={31}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
              />
            </label>
            </>}
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
                    "선택한 범위의 일정을 삭제할까요? 연결된 달력에도 삭제가 반영됩니다.",
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
    </section>
  );
}
