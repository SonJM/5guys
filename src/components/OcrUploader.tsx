"use client";

import { useEffect, useRef, useState } from "react";
import { loadPlanner, saveEvents } from "@/app/planner-actions";
import { dayString, relinkVisionRows, shiftDisplayColor, shiftTimes, validDay, type ShiftPattern } from "@/lib/planner";
import WorkPatternEditor from "@/components/WorkPatternEditor";

type Row = { day: number; label: string; patternId: string; included: boolean; confidence: number; manual?: boolean };
const monthPattern = /^20\d{2}-(0[1-9]|1[0-2])$/;

export default function OcrUploader() {
  const [image, setImage] = useState("");
  const img = useRef<HTMLImageElement>(null);
  const autoImage = useRef("");
  const [month, setMonth] = useState("");
  const [monthEditing, setMonthEditing] = useState(false);
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [fileName, setFileName] = useState("");
  const [analysisDone, setAnalysisDone] = useState(false);
  const [patternsOpen, setPatternsOpen] = useState(false);

  useEffect(() => {
    loadPlanner(dayString(), dayString())
      .then((data) => setPatterns(data.patterns))
      .catch((error) => setMessage((error as Error).message));
  }, []);
  useEffect(() => {
    const open = () => setPatternsOpen(true);
    window.addEventListener("planner-open-patterns", open);
    return () => window.removeEventListener("planner-open-patterns", open);
  }, []);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);
  useEffect(() => {
    if (!reviewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy && !patternsOpen) setReviewOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reviewOpen, busy, patternsOpen]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try { await task(); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); setProgress(""); }
  }

  async function processPhoto() {
    if (!img.current) throw new Error("사진을 선택해주세요.");
    setProgress("사진에서 근무표를 분석하고 있어요…");
    const source = img.current;
    const width = source.naturalWidth;
    const height = source.naturalHeight;
    if (!width || !height) throw new Error("사진을 열지 못했습니다. 다른 이미지를 선택해주세요.");
    const scale = Math.min(1, 3000 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("이미지를 처리하지 못했습니다.");
    if (blob.size > 4000000) throw new Error("이미지가 4MB를 넘습니다. 더 작은 사진을 선택해주세요.");
    const form = new FormData();
    form.append("file", blob, "schedule.jpg");
    const response = await fetch("/api/ocr/analyze", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "근무표 분석에 실패했습니다.");
    setMonth(data.month);
    setMonthEditing(!data.month);
    setRows(data.rows);
    setWarnings(data.warnings);
    setSelectedDay(data.rows[0]?.day ?? 1);
    setReviewOpen(true);
    setAnalysisDone(true);
  }

  function changePattern(day: number, patternId: string) {
    setRows((current) => {
      const existing = current.find((row) => row.day === day);
      if (existing) return current.map((row) => row.day === day
        ? { ...row, patternId, included: Boolean(patternId), manual: true }
        : row);
      if (!patternId) return current;
      return [...current, { day, label: "직접 추가", patternId, included: true, confidence: 1, manual: true }]
        .sort((a, b) => a.day - b.day);
    });
  }

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth);
    if (!monthPattern.test(nextMonth)) return;
    const days = new Date(Number(nextMonth.slice(0, 4)), Number(nextMonth.slice(5)), 0).getDate();
    setRows((current) => current.map((row) => row.day > days ? { ...row, included: false } : row));
    setSelectedDay((current) => Math.min(current, days));
  }

  async function save() {
    if (!monthPattern.test(month)) throw new Error("근무표의 연월을 확인해주세요.");
    const selected = rows.filter((row) => row.included && row.patternId);
    if (!selected.length) throw new Error("등록할 근무가 없습니다. 달력에서 날짜와 근무 유형을 확인해주세요.");
    const payload = selected.map((row) => {
      const date = `${month}-${String(row.day).padStart(2, "0")}`;
      if (!validDay(date)) throw new Error(`${row.day}일은 ${month}에 없는 날짜입니다. 해당 날짜를 제외해주세요.`);
      const pattern = patterns.find((item) => item.id === row.patternId);
      if (!pattern) throw new Error(`${row.day}일의 근무 유형을 확인해주세요.`);
      return { pattern, date };
    });
    const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
    const existing = await loadPlanner(`${month}-01`, `${month}-${lastDay}`);
    const conflict = payload.find(({ pattern, date }) => !pattern.is_off && existing.events.some(
      (event) => event.kind === "work" && dayString(new Date(event.starts_at)) === date,
    ));
    if (conflict) {
      setSelectedDay(Number(conflict.date.slice(8)));
      throw new Error(`${conflict.date}에는 이미 근무가 있습니다. 해당 날짜를 결과에서 제외해주세요.`);
    }
    const working = payload.filter(({ pattern }) => !pattern.is_off).map(({ pattern, date }) => ({
      title: pattern.label,
      kind: "work" as const,
      source: "ocr" as const,
      ...shiftTimes(date, pattern),
    }));
    if (working.length) await saveEvents(working);
    if (working.length) {
      window.dispatchEvent(new Event("planner-synced"));
      window.dispatchEvent(new Event("planner-local-change"));
    }
    setReviewOpen(false);
    setRows([]);
    setMessage(`${working.length}건의 근무를 등록했습니다. 휴무는 바쁜 일정으로 저장하지 않습니다.`);
  }

  const validMonth = monthPattern.test(month);
  const lastDay = validMonth ? new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() : 31;
  const firstWeekday = validMonth ? (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7 : 0;
  const selectedRow = rows.find((row) => row.day === selectedDay);
  const selectedPattern = patterns.find((pattern) => pattern.id === selectedRow?.patternId);
  const includedCount = rows.filter((row) => row.included && row.patternId).length;
  const needsReview = rows.filter((row) => !row.patternId || row.confidence < 0.85).length;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-extrabold">근무표 사진으로 일정 만들기</h2>
      <p className="muted text-sm leading-6">사진을 올리면 연월과 근무를 자동으로 분석합니다. 결과 달력에서 잘못 읽은 날짜만 눌러 수정한 뒤 등록하세요.</p>
      <button type="button" disabled={busy} className="brand-link text-sm" onClick={() => setPatternsOpen(true)}>나의 근무 표기·시간 설정 →</button>
      <label htmlFor="shift-photo" className={`primary-button ${busy ? "pointer-events-none opacity-50" : ""}`}>{image ? "사진 바꾸기" : "근무표 사진 선택"}</label>
      <input
        id="shift-photo"
        aria-label="근무표 이미지"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          event.currentTarget.value = "";
          if (file.size > 15000000) { setMessage("15MB 이하 이미지를 선택해주세요."); return; }
          const url = URL.createObjectURL(file);
          autoImage.current = url;
          setImage(url);
          setFileName(file.name);
          setAnalysisDone(false);
          setRows([]);
          setReviewOpen(false);
        }}
      />
      {fileName && <p className="muted text-xs"><span className="font-semibold">{fileName}</span> · {busy ? "처리 중" : analysisDone ? "분석 완료" : "사진 선택됨"}</p>}
      {busy && <p role="status" className="status-note">{progress || "처리 중입니다…"}</p>}
      {message && <p role="status" className="status-note">{message}</p>}
      {image && (
        <div className="space-y-3">
          <div className="mx-auto max-w-xs overflow-hidden rounded-2xl border border-[var(--line)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={img}
              src={image}
              alt="업로드한 근무표"
              className="w-full"
              onLoad={() => {
                if (autoImage.current !== image) return;
                autoImage.current = "";
                void run(processPhoto);
              }}
              onError={() => { autoImage.current = ""; setMessage("사진을 열지 못했습니다. PNG·JPEG·WebP 이미지를 선택해주세요."); }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className="secondary-button" onClick={() => void run(processPhoto)}>사진 다시 분석</button>
            {rows.length > 0 && <button type="button" disabled={busy} className="primary-button" onClick={() => setReviewOpen(true)}>분석 결과 확인·수정</button>}
          </div>
        </div>
      )}
      {reviewOpen && !patternsOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setReviewOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="근무표 분석 결과 확인" className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-[var(--surface)] shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
              <div><h3 className="text-lg font-extrabold">근무표 분석 결과</h3><p className="muted mt-1 text-xs">{includedCount}일 자동 선택 · {needsReview ? `${needsReview}일 확인 필요` : "달력을 눌러 수정 가능"}</p></div>
              <button type="button" className="ghost-button !min-h-9" aria-label="닫기" disabled={busy} onClick={() => setReviewOpen(false)}>✕</button>
            </div>
            <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
              {warnings.length > 0 && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">{warnings.join(" · ")}</p>}
              <div className="mb-3 flex items-center justify-between gap-2">
                <strong className="text-base">{validMonth ? `${month.slice(0, 4)}년 ${Number(month.slice(5))}월` : "연월 확인 필요"}</strong>
                <button type="button" className="brand-link text-xs" onClick={() => setMonthEditing((value) => !value)}>연월 수정</button>
              </div>
              {monthEditing && <input aria-label="분석된 근무표 연월 수정" type="month" value={month} onChange={(event) => changeMonth(event.target.value)} className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 text-sm" />}
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[var(--muted)]">
                {["월", "화", "수", "목", "금", "토", "일"].map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
                {Array.from({ length: lastDay }, (_, index) => {
                  const day = index + 1;
                  const row = rows.find((item) => item.day === day);
                  const pattern = patterns.find((item) => item.id === row?.patternId);
                  const active = Boolean(row?.included && pattern);
                  const color = pattern ? shiftDisplayColor(pattern, patterns) : undefined;
                  const warning = Boolean(row && (!row.patternId || row.confidence < 0.85));
                  return <button
                    key={day}
                    type="button"
                    aria-label={`${day}일 ${row?.label ?? "일정 없음"}${warning ? ", 확인 필요" : ""}`}
                    aria-pressed={selectedDay === day}
                    onClick={() => setSelectedDay(day)}
                    className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border text-xs transition-transform active:scale-95 ${selectedDay === day ? "border-[var(--brand)] bg-[var(--brand-light)]" : warning ? "border-amber-500 bg-amber-50 dark:bg-amber-950" : "border-[var(--line)]"}`}
                  >
                    <span className="font-bold">{day}</span>
                    {row && <span className={`max-w-full truncate rounded-md px-1 text-[10px] font-bold ${active ? "bg-[var(--surface)]" : "text-[var(--muted)] line-through"}`} style={active ? { color } : undefined}>{pattern?.label ?? row.label}</span>}
                  </button>;
                })}
              </div>
              {rows.some((row) => row.day > lastDay) && <p className="mt-2 text-xs text-amber-700">선택한 연월에 없는 날짜는 등록에서 제외했습니다. 연월을 확인해주세요.</p>}
              <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                <div className="flex items-center justify-between gap-2"><strong>{selectedDay}일</strong>{selectedRow && <span className="text-xs text-[var(--muted)]">사진 표기: {selectedRow.label}</span>}</div>
                {selectedRow && (!selectedRow.patternId || selectedRow.confidence < 0.85) && <p className="mt-1 text-xs text-amber-700">근무 표기 또는 날짜 연결을 확인해주세요.</p>}
                <label className="mt-3 block text-xs font-semibold">근무 유형
                  <select aria-label={`${selectedDay}일 근무 유형`} value={selectedRow?.patternId ?? ""} onChange={(event) => changePattern(selectedDay, event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm">
                    <option value="">일정 없음 / 제외</option>
                    {patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.label}{pattern.is_off ? " · 휴무" : ""}</option>)}
                  </select>
                </label>
                {selectedRow?.patternId && <button type="button" className="mt-2 text-xs text-[var(--brand)]" onClick={() => setRows((current) => current.map((row) => row.day === selectedDay ? { ...row, included: !row.included, manual: true } : row))}>{selectedRow.included ? "이 날짜 제외" : "이 날짜 포함"}</button>}
                <button type="button" disabled={busy} className="mt-3 block brand-link text-xs" onClick={() => setPatternsOpen(true)}>근무 유형 추가·수정</button>
                {selectedPattern?.is_off && selectedRow?.included && <p className="muted mt-2 text-xs">휴무는 바쁜 일정으로 저장하지 않습니다.</p>}
              </div>
            </div>
            <div className="border-t border-[var(--line)] p-4 sm:p-5">
              {message && <p role="status" className="mb-3 text-sm text-[#a54036]">{message}</p>}
              <button type="button" disabled={busy || !includedCount || !validMonth} className="primary-button w-full" onClick={() => void run(save)}>{busy ? "등록 중…" : `${includedCount}일 근무 확인 후 등록`}</button>
            </div>
          </div>
        </div>
      )}
      {patternsOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5">
        <div role="dialog" aria-modal="true" aria-label="근무 유형 설정" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[var(--surface)] p-5 sm:rounded-3xl">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-extrabold">근무 유형 설정</h3><button type="button" className="secondary-button !min-h-9" onClick={() => setPatternsOpen(false)}>분석 작업으로 돌아가기</button></div>
          <WorkPatternEditor onChanged={(updated) => { setPatterns(updated); setRows((current) => relinkVisionRows(current, updated)); }} />
        </div>
      </div>}
    </section>
  );
}
