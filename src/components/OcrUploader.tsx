"use client";

import { useEffect, useRef, useState } from "react";
import { loadPlanner, saveEvents } from "@/app/planner-actions";
import { changeReviewPeriod, dayString, relinkVisionRows, reviewDates, shiftDisplayColor, shiftTimes, validDay, type ShiftPattern, type VisionRow } from "@/lib/planner";
import WorkPatternEditor from "@/components/WorkPatternEditor";

type Row = VisionRow;

export default function OcrUploader() {
  const [image, setImage] = useState("");
  const img = useRef<HTMLImageElement>(null);
  const autoImage = useRef("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [periodEditing, setPeriodEditing] = useState(false);
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
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
    setPeriodStart(data.periodStart);
    setPeriodEnd(data.periodEnd);
    setDraftStart(data.periodStart);
    setDraftEnd(data.periodEnd);
    setPeriodEditing(!reviewDates(data.periodStart, data.periodEnd).length);
    setRows(data.rows);
    setWarnings(data.warnings);
    setSelectedDate(data.rows[0]?.date ?? data.periodStart);
    setSelectedKey(data.rows[0]?.key ?? '');
    setReviewOpen(true);
    setAnalysisDone(true);
  }

  function changePattern(date: string, patternId: string) {
    setRows((current) => {
      const existing = current.find((row) => selectedKey ? row.key === selectedKey : row.date === date);
      if (existing) return current.map((row) => row.key === existing.key
        ? { ...row, patternId, included: Boolean(patternId) && dates.includes(row.date), manual: true }
        : row);
      if (!patternId || !validDay(date)) return current;
      return [...current, { key: crypto.randomUUID(), date, dateLabel: date, label: "직접 추가", patternId, included: true, confidence: 1, manual: true }];
    });
  }

  function applyPeriod() {
    if (!reviewDates(draftStart, draftEnd).length) { setMessage('시작·종료 날짜를 확인해주세요. 최대 62일입니다.'); return; }
    setRows((current) => changeReviewPeriod(current, periodStart, draftStart, draftEnd));
    setPeriodStart(draftStart); setPeriodEnd(draftEnd); setSelectedDate(draftStart); setSelectedKey(''); setPeriodEditing(false); setMessage('');
  }

  async function save() {
    if (!dates.length) throw new Error("근무표의 시작·종료 날짜를 확인해주세요.");
    const selected = rows.filter((row) => row.included && row.patternId);
    if (!selected.length) throw new Error("등록할 근무가 없습니다. 달력에서 날짜와 근무 유형을 확인해주세요.");
    const seen = new Set<string>();
    const payload = selected.map((row) => {
      const date = row.date;
      if (!validDay(date) || !dates.includes(date)) throw new Error(`${row.dateLabel}: 근무표 기간 안의 날짜를 확인해주세요.`);
      if (seen.has(date)) throw new Error(`${date}에 중복 근무가 있습니다. 날짜를 수정하거나 한 항목을 제외해주세요.`);
      seen.add(date);
      const pattern = patterns.find((item) => item.id === row.patternId);
      if (!pattern) throw new Error(`${date}의 근무 유형을 확인해주세요.`);
      return { pattern, date };
    });
    const existing = await loadPlanner(periodStart, periodEnd);
    const conflict = payload.find(({ pattern, date }) => !pattern.is_off && existing.events.some(
      (event) => event.kind === "work" && dayString(new Date(event.starts_at)) === date,
    ));
    if (conflict) {
      setSelectedDate(conflict.date); setSelectedKey('');
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

  const dates = reviewDates(periodStart, periodEnd);
  const firstWeekday = dates.length ? (new Date(`${periodStart}T00:00:00Z`).getUTCDay() + 6) % 7 : 0;
  const selectedRow = rows.find((row) => selectedKey ? row.key === selectedKey : !!selectedDate && row.date === selectedDate);
  const selectedPattern = patterns.find((pattern) => pattern.id === selectedRow?.patternId);
  const includedCount = rows.filter((row) => row.included && row.patternId).length;
  const needsReview = rows.filter((row) => !row.patternId || !row.date || row.confidence < 0.85).length;
  const unresolved = rows.filter((row) => !dates.includes(row.date));

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-extrabold">근무표 사진으로 일정 만들기</h2>
      <p className="muted text-sm leading-6">주간·월간 근무표 사진을 올리면 날짜와 근무를 분석합니다. 결과 달력에서 필요한 부분만 수정한 뒤 등록하세요.</p>
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
            <fieldset disabled={busy} className="min-h-0 min-w-0 overflow-y-auto px-4 py-4 sm:px-6">
              {warnings.length > 0 && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">{warnings.join(" · ")}</p>}
              <div className="mb-3 flex items-center justify-between gap-2">
                <strong className="text-sm">{dates.length ? `${periodStart} ~ ${periodEnd}` : "근무표 기간 확인 필요"}</strong>
                <button type="button" className="brand-link text-xs" onClick={() => { setDraftStart(periodStart); setDraftEnd(periodEnd); setPeriodEditing((value) => !value); }}>기간 수정</button>
              </div>
              {periodEditing && <div className="planner-form mb-3 rounded-xl bg-[var(--surface-soft)] p-3"><label>첫날 <input aria-label="근무표 시작일" type="date" value={draftStart} onChange={(event) => setDraftStart(event.target.value)} /></label><label>마지막 날 <input aria-label="근무표 종료일" type="date" value={draftEnd} onChange={(event) => setDraftEnd(event.target.value)} /></label><button type="button" className="secondary-button" onClick={applyPeriod}>기간 적용</button><p className="muted w-full text-xs">첫날을 바꾸면 기존 날짜도 같은 간격으로 이동합니다. 날짜가 없는 항목은 기간 안에서 한 날짜로 확인되는 표기만 연결합니다.</p></div>}
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[var(--muted)]">
                {["월", "화", "수", "목", "금", "토", "일"].map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
                {dates.map((date) => {
                  const row = rows.find((item) => item.date === date);
                  const pattern = patterns.find((item) => item.id === row?.patternId);
                  const active = Boolean(row?.included && pattern);
                  const color = pattern ? shiftDisplayColor(pattern, patterns) : undefined;
                  const warning = Boolean(row && (!row.patternId || row.confidence < 0.85));
                  return <button
                    key={date}
                    type="button"
                    aria-label={`${date} ${row?.label ?? "일정 없음"}${warning ? ", 확인 필요" : ""}`}
                    aria-pressed={selectedDate === date}
                    onClick={() => { setSelectedDate(date); setSelectedKey(row?.key ?? ''); }}
                    className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border text-xs transition-transform active:scale-95 ${selectedDate === date ? "border-[var(--brand)] bg-[var(--brand-light)]" : warning ? "border-amber-500 bg-amber-50 dark:bg-amber-950" : "border-[var(--line)]"}`}
                  >
                    <span className="font-bold">{periodStart.slice(0, 7) === periodEnd.slice(0, 7) ? Number(date.slice(8)) : date.slice(5).replace('-', '/')}</span>
                    {row && <span className={`max-w-full truncate rounded-md px-1 text-[10px] font-bold ${active ? "bg-[var(--surface)]" : "text-[var(--muted)] line-through"}`} style={active ? { color } : undefined}>{pattern?.label ?? row.label}</span>}
                  </button>;
                })}
              </div>
              {unresolved.length > 0 && <div className="mt-3"><p className="text-xs text-amber-700">날짜 확인 필요 {unresolved.length}건 · 선택해서 날짜를 수정해주세요.</p><div className="mt-2 flex flex-wrap gap-2">{unresolved.map((row) => <button type="button" key={row.key} className="secondary-button !min-h-9 !text-xs" onClick={() => { setSelectedKey(row.key); setSelectedDate(row.date); }}>{row.dateLabel || '날짜 미확인'} · {row.label}</button>)}</div></div>}
              <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                <div className="flex items-center justify-between gap-2"><strong className="text-sm">{selectedRow?.date || selectedDate || '날짜 확인 필요'}</strong>{selectedRow && <span className="text-xs text-[var(--muted)]">사진 표기: {selectedRow.label}</span>}</div>
                {selectedRow && <label className="mt-2 block text-xs">날짜 수정 <input type="date" aria-label="선택한 근무 날짜 수정" value={selectedRow.date} onChange={(event) => { const date = event.target.value; setSelectedDate(date); setRows((current) => current.map((row) => row.key === selectedRow.key ? { ...row, date, manual: true, included: !!row.patternId && dates.includes(date) } : row)); }} /></label>}
                {selectedRow && (!selectedRow.patternId || selectedRow.confidence < 0.85) && <p className="mt-1 text-xs text-amber-700">근무 표기 또는 날짜 연결을 확인해주세요.</p>}
                <label className="mt-3 block text-xs font-semibold">근무 유형
                  <select aria-label="선택한 날짜의 근무 유형" value={selectedRow?.patternId ?? ""} onChange={(event) => changePattern(selectedDate, event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm">
                    <option value="">일정 없음 / 제외</option>
                    {patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.label}{pattern.is_off ? " · 휴무" : ""}</option>)}
                  </select>
                </label>
                {selectedRow?.patternId && <button type="button" disabled={!dates.includes(selectedRow.date)} className="mt-2 text-xs text-[var(--brand)]" onClick={() => setRows((current) => current.map((row) => row.key === selectedRow.key ? { ...row, included: !row.included, manual: true } : row))}>{selectedRow.included ? "이 날짜 제외" : "이 날짜 포함"}</button>}
                <button type="button" disabled={busy} className="mt-3 block brand-link text-xs" onClick={() => setPatternsOpen(true)}>근무 유형 추가·수정</button>
                {selectedPattern?.is_off && selectedRow?.included && <p className="muted mt-2 text-xs">휴무는 바쁜 일정으로 저장하지 않습니다.</p>}
              </div>
            </fieldset>
            <div className="border-t border-[var(--line)] p-4 sm:p-5">
              {message && <p role="status" className="mb-3 text-sm text-[#a54036]">{message}</p>}
              <button type="button" disabled={busy || !includedCount || !dates.length} className="primary-button w-full" onClick={() => void run(save)}>{busy ? "등록 중…" : `${includedCount}일 근무 확인 후 등록`}</button>
            </div>
          </div>
        </div>
      )}
      {patternsOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-5">
        <div role="dialog" aria-modal="true" aria-label="근무 유형 설정" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[var(--surface)] p-5 sm:rounded-3xl">
          <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-extrabold">근무 유형 설정</h3><button type="button" className="secondary-button !min-h-9" onClick={() => setPatternsOpen(false)}>분석 작업으로 돌아가기</button></div>
          <WorkPatternEditor onChanged={(updated) => { setPatterns(updated); setRows((current) => relinkVisionRows(current, updated).map((row) => ({ ...row, included: row.included && dates.includes(row.date) }))); }} />
        </div>
      </div>}
    </section>
  );
}
