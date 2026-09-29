"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  confirmDays,
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

export default function TimePlanner() {
  const [day, setDay] = useState(dayString());
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [legacy, setLegacy] = useState<
    { date: string; status: string; event_title: string | null }[]
  >([]);
  const [confirmed, setConfirmed] = useState(false);
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
      setConfirmed(data.coverage.includes(day));
    } catch (e) {
      if (version !== requestVersion.current) return;
      setMessage((e as Error).message);
    }
  }, [day]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const listener = () => {
      void reload();
    };
    window.addEventListener("planner-synced", listener);
    return () => window.removeEventListener("planner-synced", listener);
  }, [reload]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await task();
      await reload();
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
    setNextDay(
      dayString(new Date(event.starts_at)) !==
        dayString(new Date(event.ends_at)),
    );
    setKind(event.kind);
    setScope("one");
  }
  async function save() {
    if (id && scope !== "one") {
      await updateSeries(id, title, start, end, nextDay, scope);
      setId(undefined);
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
    setMessage(
      "순환 근무를 등록했습니다. 전체 일정을 확인한 뒤 가능 시간 공유를 켜주세요.",
    );
  }
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            setDay(addDays(day, -1));
            setId(undefined);
          }}
        >
          ←
        </button>
        <input
          aria-label="조회 날짜"
          type="date"
          value={day}
          onChange={(e) => {
            if (!e.target.value) return;
            setDay(e.target.value);
            setId(undefined);
          }}
        />
        <button
          onClick={() => {
            setDay(addDays(day, 1));
            setId(undefined);
          }}
        >
          →
        </button>
        <span className="text-sm text-slate-500">
          한국 시간 · 하루에 여러 일정 등록 가능
        </span>
      </div>
      {message && (
        <p
          role="status"
          className="rounded bg-blue-50 p-3 text-sm text-blue-900"
        >
          {message}
        </p>
      )}
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(e) =>
            void run(() => confirmDays(day, day, e.target.checked))
          }
        />
        이 날짜의 일정을 모두 확인했습니다. 빈 시간을 그룹에 공유합니다.
      </label>
      <div className="max-h-[560px] overflow-auto rounded-lg border dark:border-slate-600">
        {Array.from({ length: 24 }, (_, hour) => {
          const from = `${day}T${String(hour).padStart(2, "0")}:00:00+09:00`;
          const to = Date.parse(from) + 3600000;
          const rows = events.filter(
            (e) =>
              Date.parse(e.starts_at) < to &&
              Date.parse(e.ends_at) > Date.parse(from),
          );
          return (
            <div
              key={hour}
              className="flex min-h-12 border-b dark:border-slate-700"
            >
              <span className="w-16 shrink-0 p-2 text-xs text-slate-500">
                {String(hour).padStart(2, "0")}:00
              </span>
              <div className="flex flex-1 flex-wrap gap-1 p-1">
                {rows.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => edit(e)}
                    className={`rounded px-2 py-1 text-left text-xs ${e.kind === "work" ? "bg-blue-100 text-blue-900" : "bg-purple-100 text-purple-900"}`}
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
      <form
        className="planner-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(save);
        }}
      >
        <h3 className="font-bold">{id ? "일정 수정" : "시간 일정 추가"}</h3>
        <input
          aria-label="일정 제목"
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
              onClick={() => {
                if (
                  confirm(
                    "선택한 범위의 일정을 삭제할까요? Google 연결 시 삭제도 반영됩니다.",
                  )
                )
                  void run(async () => {
                    await deleteEvents(id, scope);
                    setId(undefined);
                  });
              }}
            >
              삭제
            </button>
            <button
              type="button"
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
      <details>
        <summary className="cursor-pointer font-semibold">
          순환 교대근무 일괄 등록
        </summary>
        <div className="planner-form mt-3">
          <p className="w-full text-sm">
            근무 유형 이름을 쉼표로 입력하세요. 예: 주간, 주간, 야간, 야간,
            휴무, 휴무. 기준일은 위에서 선택한 날짜입니다.
          </p>
          <a href="/settings/work-pattern" className="text-blue-600">
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
          <button
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  "선택 날짜부터 등록 일수 전체의 빈 시간을 공유할까요? 누락된 일정이 없는지 확인해주세요.",
                )
              )
                void run(() =>
                  confirmDays(day, addDays(day, cycleDays - 1), true),
                );
            }}
          >
            기간 전체 확인·공유
          </button>
        </div>
      </details>
    </section>
  );
}
