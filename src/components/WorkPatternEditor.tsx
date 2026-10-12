"use client";
import { useEffect, useState } from "react";
import { loadPlanner, removePattern, savePattern } from "@/app/planner-actions";
import { dayString, type ShiftPattern } from "@/lib/planner";
const blank = {
  label: "",
  aliases: [] as string[],
  start_time: "09:00",
  end_time: "18:00",
  end_day_offset: 0,
  color: "#0f766e",
  is_off: false,
};
export default function WorkPatternEditor({ onChanged }: { onChanged?: (patterns: ShiftPattern[]) => void }) {
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [draft, setDraft] = useState<Partial<ShiftPattern>>(blank);
  const [aliases, setAliases] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  async function reload() {
    const data = await loadPlanner(dayString(), dayString());
    setPatterns(data.patterns);
    setLoaded(true);
    return data.patterns;
  }
  useEffect(() => {
    reload().catch((e) => setMessage(e.message)).finally(() => setLoading(false));
  }, []);
  async function perform(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
      const updated = await reload();
      onChanged?.(updated);
      window.dispatchEvent(new Event("planner-patterns-changed"));
      window.dispatchEvent(new Event("planner-synced"));
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
    <div className="space-y-6">
      <p className="muted text-sm leading-6">
        회사에서 사용하는 이름과 근무표 별칭을 등록하세요. 야간근무는 다음 날
        종료를 선택합니다. 휴무는 근무 일정을 생성하지 않습니다.
      </p>
      {message && (
        <p role="status" className="status-note">
          {message}
        </p>
      )}
      <div className="space-y-2">
        <h2 className="text-lg font-extrabold">등록된 근무 유형 {loaded && <span className="text-[var(--brand)]">{patterns.length}</span>}</h2>
        {loading && <p role="status" className="muted text-sm">근무 유형을 불러오는 중…</p>}
        {loaded && patterns.length === 0 && <p className="empty-state text-sm">아직 등록된 근무 유형이 없어요.<span>주간·야간·휴무 등 사용하는 표기부터 추가해 보세요.</span></p>}
        {patterns.map((p) => (
          <div
            key={p.id}
            className="soft-card flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <button className="text-left font-semibold"
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
            <button className="ghost-button !text-[#a54036]"
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
        className="planner-form surface-card p-5 sm:p-7"
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
        <h2 className="w-full text-lg font-extrabold">
          {draft.id ? "근무 유형 수정" : "근무 유형 추가"}
        </h2>
        <div className="w-full"><p className="mb-2 text-xs text-[var(--muted)]">예시로 시작하고 회사의 실제 근무 시간에 맞게 수정하세요. 선택만으로 저장되지는 않습니다.</p><div className="flex flex-wrap gap-2">
          {[
            { label: '주간', aliases: ['D'], start_time: '09:00', end_time: '18:00', end_day_offset: 0, color: '#2563eb', is_off: false },
            { label: '저녁', aliases: ['E'], start_time: '14:00', end_time: '22:00', end_day_offset: 0, color: '#c2410c', is_off: false },
            { label: '야간', aliases: ['N'], start_time: '22:00', end_time: '07:00', end_day_offset: 1, color: '#9333ea', is_off: false },
            { label: '휴무', aliases: ['휴', 'OFF'], start_time: '00:00', end_time: '00:00', end_day_offset: 1, color: '#0f766e', is_off: true },
          ].map((template) => <button key={template.label} type="button" disabled={busy} className="secondary-button !min-h-9" onClick={() => { setDraft(template); setAliases(template.aliases.join(',')); }}>{template.label} 예시</button>)}
        </div></div>
        <label>앱에서 보여줄 이름
        <input
          aria-label="근무 이름"
          required
          maxLength={40}
          placeholder="예: 야간"
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        />
        </label>
        <label>사진에서 읽힐 표기 (쉼표로 구분)
        <input
          aria-label="근무표 별칭"
          placeholder="별칭: N,야,나이트"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
        />
        </label>
        <label>표시 색상
        <input
          aria-label="표시 색상"
          type="color"
          value={draft.color}
          onChange={(e) => setDraft({ ...draft, color: e.target.value })}
        />
        </label>
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
        <button disabled={busy || loading || !loaded} className="primary-button">
          저장
        </button>
        {draft.id && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setDraft(blank);
              setAliases("");
            }}
          >
            새 유형
          </button>
        )}
      </form>
    </div>
  );
}
