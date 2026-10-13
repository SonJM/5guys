"use client";
import { useEffect, useRef, useState } from "react";
import { availability, availabilityMonth, availabilityRange } from "@/app/planner-actions";
import { addDays, commonWindows, dayString, localInput } from "@/lib/planner";
import MonthGrid, { monthBounds } from "@/components/MonthGrid";
import GroupPlans from "@/components/GroupPlans";
export default function GroupAvailability({
  groupId,
  userId,
  onManageGroup,
  onFindPlace,
}: {
  groupId: number | null;
  userId: string;
  onManageGroup?: () => void;
  onFindPlace?: (planId: string) => void;
}) {
  const [day, setDay] = useState(dayString());
  const [month, setMonth] = useState(dayString().slice(0, 7));
  const [lastDay, setLastDay] = useState(dayString());
  const [duration, setDuration] = useState(2);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof availability>>>(
    [],
  );
  const [message, setMessage] = useState("");
  const [monthRows, setMonthRows] = useState<Awaited<ReturnType<typeof availabilityMonth>>>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(!!groupId);
  const [showAll, setShowAll] = useState(false);
  const [preferred, setPreferred] = useState("all");
  const [revision, setRevision] = useState(0);
  const monthCache = useRef(new Map<string, Awaited<ReturnType<typeof availabilityMonth>>>());
  const [suggested, setSuggested] = useState<{ start: string; end: string; groupId: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const key = `${groupId}:${month}`;
    const cached = monthCache.current.get(key);
    setMonthRows(cached ?? []);
    setMonthLoading(!!groupId && !cached);
    if (groupId) {
      if (!cached) {
        const { first, last } = monthBounds(month);
        availabilityMonth(groupId, first, last).then((data) => {
          if (!alive) return;
          monthCache.current.set(key, data);
          if (monthCache.current.size > 6) monthCache.current.delete(monthCache.current.keys().next().value!);
          setMonthRows(data);
        }).catch((e) => { if (alive) setMessage(e.message); }).finally(() => { if (alive) setMonthLoading(false); });
      }
    }
    return () => { alive = false; };
  }, [groupId, month, revision]);
  useEffect(() => {
    const listener = () => {
      monthCache.current.clear(); setMonthRows([]); setRows([]);
      setMonthLoading(!!groupId); setRowsLoading(!!groupId); setSuggested(null);
      setRevision((value) => value + 1);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') listener(); };
    window.addEventListener('planner-synced', listener);
    window.addEventListener('focus', listener);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('planner-synced', listener);
      window.removeEventListener('focus', listener);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [groupId]);
  useEffect(() => {
    let alive = true;
    setRows([]);
    setRowsLoading(!!groupId);
    setMessage("");
    if (groupId)
      availabilityRange(groupId, day, lastDay)
        .then((data) => {
          if (alive) { setRows(data); setRowsLoading(false); }
        })
        .catch((e) => {
          if (alive) { setMessage(e.message); setRowsLoading(false); }
        });
    return () => {
      alive = false;
    };
  }, [day, lastDay, groupId, revision]);
  const members = [
    ...new Map(rows.map((r) => [r.user_id, r.username])).entries(),
  ];
  const matches = commonWindows(rows, duration).filter((window) => {
    if (preferred === 'all') return true;
    const start = localInput(window.start);
    const end = localInput(window.end);
    const minHour = preferred === 'evening' ? 18 : 9;
    return start.slice(0, 10) === end.slice(0, 10) && Number(start.slice(11, 13)) >= minHour && end.slice(11) <= '22:00';
  });
  const dayMatches = matches.filter((window) => localInput(window.start).slice(0, 10) === day);
  return (
    <section className="min-w-0 space-y-4">
      <div className="hidden sm:block"><h2 className="text-xl font-extrabold">그룹의 공통 가능 시간</h2><p className="muted mt-2 text-sm">일정 제목은 숨기고 가능한 시간만 공유합니다.</p></div>
      {!groupId && <div className="empty-state text-sm">아직 선택된 그룹이 없어요.<span>멤버 관리에서 첫 그룹을 만들어주세요.</span>{onManageGroup && <button type="button" className="primary-button" onClick={onManageGroup}>첫 그룹 만들기</button>}</div>}
      {groupId && <div className="min-w-0 px-1 py-2 sm:rounded-3xl sm:border sm:border-[var(--line)] sm:bg-[var(--surface)] sm:p-5"><MonthGrid month={month} selectedDay={day} onMonthChange={(next) => { setMonth(next); setDay(`${next}-01`); setLastDay(`${next}-01`); }} onSelect={(date) => { setDay(date); setLastDay(date); setMonth(date.slice(0, 7)); }} tone={(date) => {
        const slots = monthRows.find((row) => row.day === date)?.common_slots ?? 0;
        return slots >= duration * 2 ? "brand" : slots > 0 ? "partial" : undefined;
      }} description={(date) => {
        const slots = monthRows.find((row) => row.day === date)?.common_slots;
        return slots === undefined ? undefined : `공통 가능 ${slots / 2}시간`;
      }} />{monthLoading && <p role="status" className="muted mt-3 px-2 text-xs">그룹 달력을 불러오는 중이에요…</p>}<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-[11px] font-semibold text-[var(--muted)]"><span><span className="text-[var(--brand)]">●</span> 모두 가능</span><span><span className="text-amber-500">●</span> 일부 가능</span><span>○ 일정 있음</span></div></div>}
      {groupId && <div className="space-y-3 px-1 sm:rounded-3xl sm:border sm:border-[var(--line)] sm:bg-[var(--surface)] sm:p-5"><div className="flex items-center justify-between gap-2"><h3 className="text-base font-extrabold">{new Date(`${day}T00:00:00+09:00`).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long" })}</h3><span className="text-xs font-bold text-[var(--brand)]">{rowsLoading ? '불러오는 중…' : `${members.length}명 참여`}</span></div>{rowsLoading ? <p role="status" className="rounded-2xl bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]">가능 시간을 불러오는 중이에요…</p> : dayMatches.length ? <div className="rounded-2xl bg-[var(--brand-light)] p-4"><strong className="text-lg text-[var(--brand)]">{localInput(dayMatches[0].start).slice(11)}–{localInput(dayMatches[0].end).slice(11)}</strong><p className="mt-1 text-xs text-[var(--foreground)]">모두 함께 비어 있는 시간이에요.</p></div> : <p className="rounded-2xl bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]">선택한 날짜에 조건에 맞는 공통 시간이 없어요.</p>}<p className="muted text-xs">근무 종류와 약속 제목은 다른 구성원에게 표시하지 않습니다.</p></div>}
      {groupId && <details className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <summary className="cursor-pointer text-sm font-bold">검색 조건 · {day} ~ {lastDay} · {duration}시간</summary>
        <p className="muted mt-2 text-xs">최대 14일 범위에서 연속 시간을 찾습니다. 일정이 없는 날은 가능한 시간으로 계산되므로 각자의 최신 일정을 확인해 주세요.</p>
      <div className="planner-form rounded-2xl bg-[var(--surface-soft)] p-4">
        <label>검색 시작일 <input
          aria-label="검색 시작일"
          type="date"
          value={day}
          onChange={(e) => {
            setDay(e.target.value);
            setMonth(e.target.value.slice(0, 7));
            if (e.target.value > lastDay) setLastDay(e.target.value);
          }}
        /></label>
        <label>
          검색 종료일{" "}
          <input
            aria-label="검색 종료일"
            type="date"
            min={day}
            value={lastDay}
            onChange={(e) => setLastDay(e.target.value)}
          />
        </label>
        <label>선호 시간대 <select value={preferred} onChange={(event) => setPreferred(event.target.value)}><option value="all">전체 시간 (야간 포함)</option><option value="day">09:00–22:00</option><option value="evening">18:00–22:00</option></select></label>
        <label>
          약속 길이(시간){" "}
          <input
            type="number"
            min={0.5}
            max={336}
            step={0.5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </label>
      </div>
      <p className="muted text-xs">
        최대 14일 범위에서 연속 시간을 찾습니다. 여행은 출발부터 귀가까지
        실제 필요한 시간을 입력하세요. 1박 2일이 항상 48시간인 것은 아닙니다.
      </p>
      </details>}
      {message && <p role="alert" className="status-note">{message}</p>}
      {groupId && <details className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-bold">구성원 시간표 · {day}</summary>
      <p className="muted my-2 text-xs">표를 좌우로 밀어 하루 전체 시간을 확인하세요.</p>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="w-full min-w-[760px] text-xs">
          <thead>
            <tr className="bg-[var(--surface-soft)]">
              <th className="sticky left-0 bg-[var(--surface-soft)] p-2 text-left">구성원</th>
              {Array.from({ length: 24 }, (_, i) => (
                <th key={i} className="p-1">
                  {i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map(([id, name]) => (
              <tr key={id}>
                <th className="sticky left-0 whitespace-nowrap bg-[var(--surface)] p-2 text-left">{name}</th>
                {Array.from({ length: 24 }, (_, h) => {
                  const hour = rows.filter(
                    (r) =>
                      r.user_id === id &&
                      localInput(r.slot).slice(0, 10) === day &&
                      Number(localInput(r.slot).slice(11, 13)) === h,
                  );
                  return (
                    <td key={h} className="p-0.5">
                      <div className="flex gap-px">
                        {hour.map((r) => (
                          <span
                            key={r.slot}
                            title={`${localInput(r.slot).slice(11)} ${r.available ? "가능" : "가능 시간 아님"}`}
                            className={`h-5 w-2 rounded-sm ${r.available ? "bg-[#3aa884]" : "bg-[#82948d]"}`}
                          />
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted text-xs">
        초록: 가능 · 회색: 불가능 · 칸당 30분
      </p>
      </details>}
      {groupId && !rowsLoading && !message && <div><h3 className="mb-3 text-base font-extrabold">추천 가능한 시간 <span className="text-[var(--brand)]">{matches.length}</span></h3><div className="flex flex-wrap gap-2">
        {matches.slice(0, showAll ? 60 : 6).map((s) => (
          <button type="button" onClick={() => { if (groupId) setSuggested({ ...s, groupId }); document.getElementById("group-plan-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} title="이 시간을 그룹 계획 후보로 사용"
            key={s.start}
            className="rounded-xl bg-[var(--brand-light)] px-3 py-2 text-left text-sm font-semibold text-[var(--brand)] hover:underline"
          >
            {localInput(s.start).replace("T", " ")} ~{" "}
            {localInput(s.end).replace("T", " ")}
          </button>
        ))}
      </div>{matches.length > 6 && <button type="button" className="brand-link mt-3 text-sm" onClick={() => setShowAll((value) => !value)}>{showAll ? '추천 6개만 보기' : '다른 시간 더 보기'}</button>}</div>}
      {!rowsLoading && matches.length > 60 && showAll && (
        <p className="text-sm">
          총 {matches.length}개 중 앞선 60개 후보입니다. 검색 범위를 좁혀주세요.
        </p>
      )}
      {groupId && !rowsLoading && !message && !matches.length && (
        <div className="empty-state text-sm">
          이 조건에 모두가 가능한 시간이 없습니다.
          <button type="button" className="secondary-button" onClick={() => { setLastDay(addDays(day, 6)); setPreferred('all'); }}>선택일부터 일주일에서 찾기</button>
        </div>
      )}
      {groupId && <GroupPlans key={groupId} groupId={groupId} userId={userId} selectedDay={day} suggested={suggested?.groupId === groupId ? suggested : null} onFindPlace={onFindPlace} />}
    </section>
  );
}
