"use client";
import { useEffect, useState } from "react";
import { availability, availabilityRange } from "@/app/planner-actions";
import { commonWindows, dayString, localInput } from "@/lib/planner";
export default function GroupAvailability({
  groupId,
}: {
  groupId: number | null;
}) {
  const [day, setDay] = useState(dayString());
  const [lastDay, setLastDay] = useState(dayString());
  const [duration, setDuration] = useState(2);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof availability>>>(
    [],
  );
  const [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    setRows([]);
    setMessage("");
    if (groupId)
      availabilityRange(groupId, day, lastDay)
        .then((data) => {
          if (alive) setRows(data);
        })
        .catch((e) => {
          if (alive) setMessage(e.message);
        });
    return () => {
      alive = false;
    };
  }, [day, lastDay, groupId]);
  const members = [
    ...new Map(rows.map((r) => [r.user_id, r.username])).entries(),
  ];
  const matches = commonWindows(rows, duration);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">그룹의 공통 가능 시간</h2>
      <p className="text-sm text-slate-500">
        근무 종류와 약속 제목은 공유하지 않습니다. 각자 확인한 날짜의 빈 시간만
        표시합니다. 한국 시간 기준입니다.
      </p>
      {!groupId && <p>그룹 관리에서 그룹을 선택해주세요.</p>}
      <div className="planner-form">
        <input
          aria-label="약속 날짜"
          type="date"
          value={day}
          onChange={(e) => {
            setDay(e.target.value);
            if (e.target.value > lastDay) setLastDay(e.target.value);
          }}
        />
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
      <p className="text-xs text-slate-500">
        최대 14일 범위에서 연속 시간을 찾습니다. 여행 2일은 48시간으로
        입력하세요. 아래 표는 검색 시작일입니다.
      </p>
      {message && <p role="alert">{message}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th>구성원</th>
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
                <th className="whitespace-nowrap p-2">{name}</th>
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
                            title={`${localInput(r.slot).slice(11)} ${!r.confirmed ? "미확정" : r.available ? "가능" : "가능 시간 아님"}`}
                            className={`h-5 w-2 ${!r.confirmed ? "bg-slate-200" : r.available ? "bg-emerald-400" : "bg-slate-500"}`}
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
      <p className="text-xs text-slate-500">
        초록: 가능 · 회색: 미확정 또는 가능 시간 아님 · 칸당 30분
      </p>
      <div className="flex flex-wrap gap-2">
        {matches.slice(0, 60).map((s) => (
          <span
            key={s.start}
            className="rounded bg-emerald-100 p-2 text-sm text-emerald-900"
          >
            {localInput(s.start).replace("T", " ")} ~{" "}
            {localInput(s.end).replace("T", " ")}
          </span>
        ))}
      </div>
      {matches.length > 60 && (
        <p className="text-sm">
          총 {matches.length}개 중 앞선 60개 후보입니다. 검색 범위를 좁혀주세요.
        </p>
      )}
      {groupId && !matches.length && (
        <p>
          모두가 확인한 공통 가능 시간이 없습니다. 일정 확인 여부와 약속 길이를
          확인해주세요.
        </p>
      )}
    </section>
  );
}
