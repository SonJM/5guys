"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadPlanner, removePattern, savePattern } from "@/app/planner-actions";
import { dayString, type ShiftPattern } from "@/lib/planner";
const blank = {
  label: "",
  aliases: [] as string[],
  start_time: "09:00",
  end_time: "18:00",
  end_day_offset: 0,
  color: "#2563eb",
  is_off: false,
};
export default function WorkPatternPage() {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [draft, setDraft] = useState<Partial<ShiftPattern>>(blank);
  const [aliases, setAliases] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function reload() {
    const data = await loadPlanner(dayString(), dayString());
    setPatterns(data.patterns);
  }
  useEffect(() => {
    reload().catch((e) => setMessage(e.message));
  }, []);
  async function perform(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
      await reload();
      setDraft(blank);
      setAliases("");
      setMessage("저장했습니다. 이미 등록된 일정의 시간은 유지됩니다.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/dashboard">← 대시보드</Link>
      <h1 className="text-2xl font-bold">나의 근무 표기와 시간</h1>
      <p>
        회사에서 사용하는 이름과 OCR 별칭을 등록하세요. 야간근무는 다음 날
        종료를 선택합니다. 휴무는 근무 일정을 생성하지 않습니다.
      </p>
      {message && (
        <p role="status" className="rounded bg-blue-50 p-3 text-blue-900">
          {message}
        </p>
      )}
      <div className="space-y-2">
        {patterns.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded border p-3"
          >
            <button
              onClick={() => {
                setDraft(p);
                setAliases(p.aliases.join(","));
              }}
            >
              <span style={{ color: p.color }}>●</span> {p.label} ·{" "}
              {p.is_off
                ? "휴무"
                : `${p.start_time.slice(0, 5)}–${p.end_time.slice(0, 5)}${p.end_day_offset ? " (+1일)" : ""}`}{" "}
              · {p.aliases.join(", ")}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  confirm("이 근무 유형을 삭제할까요? 기존 일정은 유지됩니다.")
                )
                  void perform(() => removePattern(p.id));
              }}
            >
              삭제
            </button>
          </div>
        ))}
      </div>
      <form
        className="planner-form"
        onSubmit={(e) => {
          e.preventDefault();
          void perform(() =>
            savePattern({
              ...draft,
              aliases: aliases
                .split(",")
                .map((a) => a.trim())
                .filter(Boolean),
            }),
          );
        }}
      >
        <h2 className="w-full font-bold">
          {draft.id ? "근무 유형 수정" : "근무 유형 추가"}
        </h2>
        <input
          aria-label="근무 이름"
          required
          maxLength={40}
          placeholder="예: 야간"
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        />
        <input
          aria-label="OCR 별칭"
          placeholder="별칭: N,야,나이트"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
        />
        <input
          aria-label="표시 색상"
          type="color"
          value={draft.color}
          onChange={(e) => setDraft({ ...draft, color: e.target.value })}
        />
        <label>
          시작{" "}
          <input
            type="time"
            required
            value={draft.start_time}
            onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
          />
        </label>
        <label>
          종료{" "}
          <input
            type="time"
            required
            value={draft.end_time}
            onChange={(e) => setDraft({ ...draft, end_time: e.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.end_day_offset === 1}
            onChange={(e) =>
              setDraft({ ...draft, end_day_offset: e.target.checked ? 1 : 0 })
            }
          />{" "}
          다음 날 종료
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.is_off}
            onChange={(e) => setDraft({ ...draft, is_off: e.target.checked })}
          />{" "}
          휴무
        </label>
        <button disabled={busy} className="primary-button">
          저장
        </button>
        {draft.id && (
          <button
            type="button"
            onClick={() => {
              setDraft(blank);
              setAliases("");
            }}
          >
            새 유형
          </button>
        )}
      </form>
    </main>
  );
}
