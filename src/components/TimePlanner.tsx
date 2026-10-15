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
  validDay,
  type PlannerEvent,
} from "@/lib/planner";
import MonthGrid from "@/components/MonthGrid";
import { adjacentMonths, MonthCache } from "@/lib/month-cache";
import PlannerModal from '@/components/PlannerModal';

type MonthData = Awaited<ReturnType<typeof loadCalendarMonth>>;
type EditorDraft = {
  date: string; title: string; start: string; end: string; nextDay: boolean;
  kind: PlannerEvent['kind']; scope: 'one' | 'following' | 'all';
  repeat: number; frequency: 'none' | 'daily' | 'weekly' | 'monthly'; interval: number; weekdays: number[];
};

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
  const [editorDay, setEditorDay] = useState(dayString());
  const [editingEvent, setEditingEvent] = useState<PlannerEvent | null>(null);
  const drafts = useRef(new Map<string, EditorDraft>());
  const draftKey = useRef('');
  const editorError = useRef<HTMLParagraphElement>(null);
  const requestVersion = useRef(0);
  const monthCache = useRef(new MonthCache<MonthData>());
  useEffect(() => {
    if (editorOpen && message) editorError.current?.scrollIntoView({ block: 'nearest' });
  }, [editorOpen, message]);
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
    openEditor(event);
  }
  function openEditor(event: PlannerEvent | null = null) {
    const key = event ? `edit:${event.id}` : `new:${day}`;
    draftKey.current = key;
    const draft = drafts.current.get(key) ?? {
      date: event ? localInput(event.starts_at).slice(0, 10) : day,
      title: event?.title ?? '', start: event ? localInput(event.starts_at).slice(11) : '09:00',
      end: event ? localInput(event.ends_at).slice(11) : '18:00',
      nextDay: !!event && localInput(event.starts_at).slice(0, 10) !== localInput(event.ends_at).slice(0, 10),
      kind: event?.kind ?? 'appointment', scope: 'one', repeat: 1, frequency: 'none', interval: 1, weekdays: [],
    } satisfies EditorDraft;
    setId(event?.id); setEditingEvent(event); setEditorDay(draft.date);
    setTitle(draft.title); setStart(draft.start); setEnd(draft.end); setNextDay(draft.nextDay);
    setKind(draft.kind); setScope(draft.scope); setRepeat(draft.repeat); setFrequency(draft.frequency);
    setInterval(draft.interval); setWeekdays(draft.weekdays); setMessage('');
    setDetailsEvent(null);
    setEditorOpen(true);
  }
  function closeModal() {
    if (busy) return;
    if (editorOpen) {
      drafts.current.set(draftKey.current, { date: editorDay, title, start, end, nextDay, kind, scope, repeat, frequency, interval, weekdays });
      // Bound per-session drafts without storing private titles on disk.
      if (drafts.current.size > 20) drafts.current.delete(drafts.current.keys().next().value!);
    }
    setEditorOpen(false); setDetailsEvent(null);
  }
  function finishEditing() {
    drafts.current.delete(draftKey.current);
    setId(undefined); setEditorOpen(false);
  }
  async function save() {
    if (!title.trim()) throw new Error('일정 제목을 입력해주세요.');
    if (!validDay(editorDay)) throw new Error('일정 날짜를 확인해주세요.');
    if (!nextDay && end <= start) throw new Error('종료 시간을 시작 이후로 설정하거나 다음 날 종료를 선택해주세요.');
    if (id && scope !== "one") {
      await updateSeries(id, title, start, end, nextDay, scope);
      finishEditing();
      return;
    }
    const days = id ? [editorDay] : recurringDays(editorDay, frequency, interval, repeat, weekdays);
    const original = editingEvent;
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
    setDay(editorDay); setMonth(editorDay.slice(0, 7));
    finishEditing();
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
            <button type="button" className="text-sm font-extrabold text-[var(--brand)] sm:hidden" onClick={() => openEditor()}>+ 일정</button>
          </div>
          {sortedEvents.length ? sortedEvents.map((event) => (
            <button key={event.id} type="button" onClick={() => setDetailsEvent(event)} className="flex w-full items-center gap-3 rounded-2xl bg-[var(--surface)] px-4 py-3 text-left shadow-sm ring-1 ring-[var(--line)] transition-transform active:scale-[.98] sm:bg-[var(--surface-soft)] sm:shadow-none">
              <span className={`h-9 w-1 shrink-0 rounded-full ${event.kind === "appointment" ? "bg-[var(--accent)]" : event.kind === "work" ? "bg-[var(--brand)]" : "bg-slate-400"}`} style={event.kind === "work" ? { backgroundColor: workColor(event) } : undefined} aria-hidden="true" />
              <span className="min-w-0"><span className="block truncate text-sm font-bold">{event.title}</span><span className="muted mt-0.5 block text-xs">{period(event)}{event.sync_state === "conflict" && " · 변경 충돌"}</span></span>
            </button>
          )) : loadingMonth ? <p role="status" className="rounded-2xl bg-[var(--surface-soft)] px-4 py-6 text-center text-sm text-[var(--muted)]">일정을 불러오는 중이에요…</p> : <p className="rounded-2xl bg-[var(--surface-soft)] px-4 py-6 text-center text-sm text-[var(--muted)]">이날은 등록된 일정이 없어요.<br />새 일정을 추가하거나 빈 시간으로 활용해 보세요.</p>}
          <button type="button" className="primary-button hidden w-full sm:inline-flex" onClick={() => openEditor()}>+ 새 일정</button>
          <p className="muted text-xs sm:hidden">빈 시간은 소속 그룹에 자동 반영됩니다.</p>
        </div>
      </div>
      {message && !editorOpen && (
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
                    {e.title} {e.all_day ? '종일' : localInput(e.starts_at).slice(0, 10) < day ? `이전 날부터 계속 · 오늘 ${localInput(e.ends_at).slice(0, 10) > day ? '종일' : `${localInput(e.ends_at).slice(11)}까지`}` : period(e)}
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
      {(editorOpen || detailsEvent) && <PlannerModal
        title={editorOpen ? (id ? '일정 수정' : '일정 추가') : detailsEvent!.title}
        editor={editorOpen} busy={busy} onClose={closeModal}
        footer={editorOpen ? <button key="save" type="submit" form="new-event" disabled={busy} className="primary-button">{busy ? '저장 중…' : id ? '변경사항 저장' : '일정 추가하기'}</button>
          : supportsEdit ? <button key="edit" type="button" className="primary-button" onClick={(event) => { event.preventDefault(); edit(detailsEvent!); }}>일정 수정</button> : undefined}>
        {editorOpen ? <form id="new-event" onSubmit={(event) => { event.preventDefault(); void run(save); }}>
          <fieldset disabled={busy} className="event-editor-fields">
            <label>제목<input className="event-editor-title" aria-label="일정 제목" type="text" required maxLength={200} placeholder="어떤 일정인가요?" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>날짜<input aria-label="일정 날짜" type="date" required disabled={!!editingEvent?.series_id && scope !== 'one'} value={editorDay} onChange={(event) => setEditorDay(event.target.value)} /></label>
            <div>
              <div className="event-editor-times"><label className="event-field">시작<input aria-label="시작 시간" required type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label><span aria-hidden="true">→</span><label className="event-field">종료<input aria-label="종료 시간" required type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div>
              <label className="event-editor-nextday"><input type="checkbox" checked={nextDay} onChange={(event) => setNextDay(event.target.checked)} />다음 날 종료</label>
              {nextDay && validDay(editorDay) && <p className="muted text-xs">{addDays(editorDay, 1)} {end}에 끝나는 일정이에요.</p>}
            </div>
            {!id && <>
              <label>반복<select aria-label="반복 주기" value={frequency} onChange={(event) => setFrequency(event.target.value as typeof frequency)}><option value="none">반복 안 함</option><option value="daily">매일</option><option value="weekly">매주</option><option value="monthly">매월 같은 날짜</option></select></label>
              {frequency !== 'none' && <div className="event-editor-options">
                {frequency === 'weekly' && <fieldset><legend className="text-sm font-semibold">반복 요일</legend><div className="event-editor-weekdays">{['일','월','화','수','목','금','토'].map((label, index) => <label key={label}><input type="checkbox" checked={weekdays.includes(index)} onChange={(event) => setWeekdays(event.target.checked ? [...weekdays, index] : weekdays.filter((day) => day !== index))} />{label}</label>)}</div><p className="muted text-xs">요일을 선택하지 않으면 시작일의 요일로 반복해요.</p></fieldset>}
                <div className="event-editor-options-grid"><label className="event-field">반복 횟수<input aria-label="반복 횟수" type="number" min={1} max={52} required value={repeat} onChange={(event) => setRepeat(Number(event.target.value))} /></label><label className="event-field">반복 간격 ({frequency === 'daily' ? '일' : frequency === 'weekly' ? '주' : '개월'})<input aria-label="반복 간격" type="number" min={1} max={31} required value={interval} onChange={(event) => setInterval(Number(event.target.value))} /></label></div>
              </div>}
            </>}
            {editingEvent?.series_id && <label>변경·삭제 범위<select aria-label="수정 범위" value={scope} onChange={(event) => { const value = event.target.value as typeof scope; setScope(value); if (value !== 'one') setEditorDay(localInput(editingEvent.starts_at).slice(0, 10)); }}><option value="one">이번 일정만</option><option value="following">이 일정과 이후 반복</option><option value="all">전체 반복</option></select>{scope !== 'one' && <span className="muted text-xs">각 일정의 날짜는 유지하고 제목과 시간을 함께 변경해요.</span>}</label>}
            {id && <details><summary className="muted text-sm">일정 관리</summary><button type="button" className="event-editor-delete" onClick={() => {
              if (window.confirm('선택한 범위의 일정을 삭제할까요? 연결된 달력에도 삭제가 반영됩니다.')) void run(async () => { await deleteEvents(id, scope); finishEditing(); });
            }}>일정 삭제</button></details>}
            {message && <p ref={editorError} role="alert" className="event-editor-error">{message}</p>}
          </fieldset>
        </form> : detailsEvent && <div className="space-y-4">
          <p className="muted text-xs">조회 중인 날짜: {day}</p>
          <p className="text-sm">{detailsEvent.all_day ? period(detailsEvent) : `${localInput(detailsEvent.starts_at).replace('T', ' ')} ~ ${localInput(detailsEvent.ends_at).replace('T', ' ')}`}</p>
          <p className="muted text-xs">{detailsEvent.source === 'google' ? '외부 캘린더에서 가져온 일정' : detailsEvent.source === 'ocr' ? '근무표 사진에서 등록한 일정' : '앱에서 등록한 일정'}{detailsEvent.series_id && ' · 반복 일정'}</p>
          {!supportsEdit && <p className="muted text-sm">{detailsEvent.kind === 'work' ? '근무는 사진 분석 결과에서 등록합니다.' : '종일·여러 날 일정의 기간 수정은 아직 지원하지 않습니다. 가져온 일정은 원본 캘린더에서 수정할 수 있어요.'}</p>}
        </div>}
      </PlannerModal>}
    </section>
  );
}
