"use client";
import { useEffect, useRef, useState } from "react";
import { loadPlanner, saveEvents } from "@/app/planner-actions";
import { dayString, shiftTimes, type ShiftPattern } from "@/lib/planner";
type Row = {
  date: string;
  label: string;
  patternId: string;
  confirmed: boolean;
  confidence: number;
};
export default function OcrUploader() {
  const [image, setImage] = useState("");
  const img = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState({
    top: 0,
    bottom: 100,
    left: 0,
    right: 100,
  });
  const [text, setText] = useState("");
  const [layout, setLayout] = useState<unknown[]>([]);
  const [month, setMonth] = useState(dayString().slice(0, 7));
  const [person, setPerson] = useState("");
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    loadPlanner(dayString(), dayString())
      .then((d) => setPatterns(d.patterns))
      .catch((e) => setMessage(e.message));
  }, []);
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image);
    },
    [image],
  );
  async function request(url: string, body: BodyInit, json = false) {
    const response = await fetch(url, {
      method: "POST",
      headers: json ? { "Content-Type": "application/json" } : undefined,
      body,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "요청에 실패했습니다.");
    return data;
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function recognize() {
    if (!img.current || crop.right <= crop.left || crop.bottom <= crop.top)
      throw new Error("달력 영역을 확인해주세요.");
    setRows([]);
    setText("");
    setLayout([]);
    const source = img.current;
    const w = source.naturalWidth;
    const h = source.naturalHeight;
    const canvas = document.createElement("canvas");
    const width = (w * (crop.right - crop.left)) / 100;
    const height = (h * (crop.bottom - crop.top)) / 100;
    const scale = Math.min(1, 2400 / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas
      .getContext("2d")!
      .drawImage(
        source,
        (w * crop.left) / 100,
        (h * crop.top) / 100,
        width,
        height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("이미지를 처리하지 못했습니다.");
    const form = new FormData();
    form.append("file", blob, "calendar.png");
    const data = await request("/api/ocr", form);
    setText(data.ocrResult);
    setLayout(data.layout);
  }
  async function analyze() {
    const [year, m] = month.split("-").map(Number);
    const data = await request(
      "/api/ocr/analyze",
      JSON.stringify({ ocrText: text, layout, year, month: m, person }),
      true,
    );
    setRows(data.rows);
    setMessage(
      data.warnings.join(" · ") ||
        "날짜와 근무 유형을 확인한 항목만 선택해 저장해주세요.",
    );
  }
  async function save() {
    const selected = rows.filter((r) => r.confirmed);
    if (!selected.length) throw new Error("확인한 항목을 선택해주세요.");
    const ids = new Set<string>();
    const payload = selected.map((r) => {
      if (ids.has(r.date)) throw new Error("중복 날짜를 확인해주세요.");
      ids.add(r.date);
      const p = patterns.find((p) => p.id === r.patternId);
      if (!p) throw new Error(`${r.date}: 근무 유형을 선택해주세요.`);
      return { p, date: r.date };
    });
    const existing = await loadPlanner(
      `${month}-01`,
      `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`,
    );
    if (
      payload.some(
        ({ p, date }) =>
          !p.is_off &&
          existing.events.some(
            (e) =>
              e.kind === "work" && dayString(new Date(e.starts_at)) === date,
          ),
      )
    )
      throw new Error(
        "선택한 날짜에 이미 근무가 있습니다. 기존 근무를 수정하거나 해당 날짜 선택을 해제해주세요.",
      );
    const working = payload
      .filter(({ p }) => !p.is_off)
      .map(({ p, date }) => ({
        title: p.label,
        kind: "work" as const,
        source: "ocr" as const,
        ...shiftTimes(date, p),
      }));
    if (working.length) await saveEvents(working);
    if (working.length) window.dispatchEvent(new Event('planner-local-change'));
    setRows([]);
    setMessage(
      `${working.length}건의 근무를 등록했습니다. 휴무는 근무를 만들지 않습니다. 빈 시간은 그룹 달력에 자동 반영됩니다.`,
    );
  }
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-[var(--brand-light)] px-3 py-1.5 text-[var(--brand)]">1 사진 선택</span><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5">2 영역 인식</span><span className="rounded-full bg-[var(--surface-soft)] px-3 py-1.5">3 결과 확인</span></div>
      <h2 className="text-xl font-extrabold">근무표 사진으로 일정 만들기</h2>
      <p className="muted text-sm leading-6">
        달력과 연월만 남도록 영역을 조정하세요. 광고·하단 메뉴는 제외하고, 여러
        사람의 표라면 본인 이름을 입력하세요.
      </p>
      <a href="/settings/work-pattern" className="brand-link text-sm">
        나의 근무 표기·시간 설정 →
      </a>
      <input
        aria-label="근무표 이미지"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        className="block w-full rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-soft)] p-5 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--brand)] file:px-4 file:py-2 file:font-bold file:text-white dark:file:text-[#10352e]"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 15000000) {
            setMessage("15MB 이하 이미지를 선택해주세요.");
            return;
          }
          setImage(URL.createObjectURL(f));
          setRows([]);
          setText("");
          setLayout([]);
          setCrop({ top: 0, bottom: 100, left: 0, right: 100 });
        }}
      />
      {image && (
        <>
          <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl border border-[var(--line)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={img}
              src={image}
              alt="근무표 영역 선택 미리보기"
              className="w-full"
            />
            <div
              className="pointer-events-none absolute border-4 border-emerald-400 bg-emerald-200/10"
              style={{
                top: `${crop.top}%`,
                left: `${crop.left}%`,
                right: `${100 - crop.right}%`,
                bottom: `${100 - crop.bottom}%`,
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["top", "bottom", "left", "right"] as const).map((key, i) => (
              <label key={key} className="text-sm">
                {["상단", "하단", "왼쪽", "오른쪽"][i]} {crop[key]}%
                <input
                  className="w-full"
                  type="range"
                  min={0}
                  max={100}
                  value={crop[key]}
                  disabled={busy}
                  onChange={(e) =>
                    setCrop({ ...crop, [key]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
          <button
            disabled={busy}
            className="primary-button"
            onClick={() => void run(recognize)}
          >
            선택한 영역 인식
          </button>
        </>
      )}
      <div className="planner-form rounded-2xl bg-[var(--surface-soft)] p-4">
        <input
          aria-label="근무표 연월"
          type="month"
          value={month}
          disabled={busy}
          onChange={(e) => {
            setMonth(e.target.value);
            setRows([]);
          }}
        />
        <input
          aria-label="근무표 본인 이름"
          placeholder="여러 사람의 표: 본인 이름"
          value={person}
          disabled={busy}
          onChange={(e) => {
            setPerson(e.target.value);
            setRows([]);
          }}
        />
      </div>
      <textarea
        aria-label="인식된 텍스트"
        placeholder="사진을 인식하면 추출한 텍스트가 표시됩니다."
        value={text}
        readOnly
        className="h-32 w-full"
      />
      <button
        disabled={busy || !text.trim()}
        className="primary-button"
        onClick={() => void run(analyze)}
      >
        날짜별 근무 분석
      </button>
      {busy && <p role="status">처리 중입니다…</p>}
      {message && (
        <p
          role="status"
          className="status-note"
        >
          {message}
        </p>
      )}
      {rows.length > 0 && (
        <>
          <p className="muted text-sm">
            날짜별 결과를 확인하세요. 낮은 확신도와 미등록 기호는 반드시
            수정해주세요.
          </p>
          {rows.map((row, i) => (
            <div key={row.date} className="planner-form rounded-xl border border-[var(--line)] p-3">
              <input
                aria-label={`${row.date} 확인`}
                type="checkbox"
                disabled={!row.patternId || busy}
                checked={row.confirmed}
                onChange={(e) =>
                  setRows(
                    rows.map((r, j) =>
                      j === i ? { ...r, confirmed: e.target.checked } : r,
                    ),
                  )
                }
              />
              <span>
                {row.date} · {row.label}{" "}
                {row.confidence < 0.85 ? "⚠ 확인 필요" : ""}
              </span>
              <select
                aria-label={`${row.date} 근무 유형`}
                value={row.patternId}
                disabled={busy}
                onChange={(e) =>
                  setRows(
                    rows.map((r, j) =>
                      j === i
                        ? { ...r, patternId: e.target.value, confirmed: false }
                        : r,
                    ),
                  )
                }
              >
                <option value="">근무 유형 선택</option>
                {patterns.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            disabled={busy}
            className="primary-button"
            onClick={() => void run(save)}
          >
            확인한 일정 등록
          </button>
        </>
      )}
    </section>
  );
}
