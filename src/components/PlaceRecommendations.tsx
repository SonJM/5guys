"use client";
import { useState } from "react";
type Candidate = {
  id: string;
  name: string;
  address: string;
  url: string;
  reason: string;
  journeys: {
    name: string;
    origin: string;
    mode: string;
    minutes: number | null;
    summary: string;
    warning: string;
  }[];
};
export default function PlaceRecommendations() {
  const [type, setType] = useState("cafe");
  const [region, setRegion] = useState("");
  const [people, setPeople] = useState([
    { name: "나", origin: "", mode: "transit" },
  ]);
  const [results, setResults] = useState<Candidate[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function search() {
    setBusy(true);
    setMessage("");
    setResults([]);
    try {
      const r = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, region, participants: people }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResults(data.results);
      setMessage(
        `${data.ai ? "AI 추천 설명 포함 · " : ""}${data.note}${data.results.length ? "" : " 검색 결과가 없습니다."}`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-extrabold">모두에게 편한 장소 찾기</h2>
      <p className="muted text-sm leading-6">
        국내 장소를 검색하고 구성원별 이동 시간을 비교합니다. 출발지는 이번
        검색에만 사용하며 그룹에 저장하지 않습니다.
      </p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <div className="planner-form rounded-2xl bg-[var(--surface-soft)] p-4">
          <select
            aria-label="약속 유형"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="cafe">카페</option>
            <option value="dinner">저녁</option>
            <option value="drinks">술</option>
            <option value="trip">국내 여행</option>
          </select>
          <input
            aria-label="희망 지역"
            required
            placeholder="희망 지역: 성수동, 부산 등"
            maxLength={80}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
        </div>
        <h3 className="text-sm font-extrabold">출발지와 이동수단</h3>
        {people.map((p, i) => (
          <div key={i} className="planner-form rounded-xl border border-[var(--line)] p-3">
            <span className="rounded-full bg-[var(--brand-light)] px-2 py-1 text-xs font-bold text-[var(--brand)]">{i + 1}</span>
            <input
              aria-label={`참여자 ${i + 1} 이름`}
              required
              placeholder="이름"
              maxLength={30}
              value={p.name}
              onChange={(e) =>
                setPeople(
                  people.map((r, j) =>
                    i === j ? { ...r, name: e.target.value } : r,
                  ),
                )
              }
            />
            <input
              aria-label={`참여자 ${i + 1} 출발지`}
              required
              placeholder="출발 역 또는 장소"
              maxLength={100}
              value={p.origin}
              onChange={(e) =>
                setPeople(
                  people.map((r, j) =>
                    i === j ? { ...r, origin: e.target.value } : r,
                  ),
                )
              }
            />
            <select
              aria-label={`참여자 ${i + 1} 이동수단`}
              value={p.mode}
              onChange={(e) =>
                setPeople(
                  people.map((r, j) =>
                    i === j ? { ...r, mode: e.target.value } : r,
                  ),
                )
              }
            >
              <option value="transit">대중교통</option>
              <option value="car">자동차</option>
            </select>
            {people.length > 1 && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setPeople(people.filter((_, j) => i !== j))}
              >
                제외
              </button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="secondary-button"
            disabled={people.length >= 8}
            onClick={() =>
              setPeople([...people, { name: "", origin: "", mode: "transit" }])
            }
          >
            + 참여자
          </button>
          <button disabled={busy} className="primary-button">
            {busy ? "장소와 이동 시간 비교 중…" : "장소 추천받기"}
          </button>
        </div>
      </form>
      {message && (
        <p role="status" className="status-note">
          {message}
        </p>
      )}
      {results.map((p, index) => (
        <article key={p.id} className="space-y-3 rounded-2xl border border-[var(--line)] p-5">
          <span className="eyebrow">추천 장소 {index + 1}</span>
          <h3 className="font-bold">
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="brand-link"
            >
              {p.name} ↗
            </a>
          </h3>
          <p className="muted text-sm">{p.address}</p>
          {p.reason && <p className="text-sm">{p.reason}</p>}
          <ul className="space-y-2">
            {p.journeys.map((j, i) => (
              <li
                key={i}
                className="rounded-xl bg-[var(--surface-soft)] p-3 text-sm"
              >
                <strong>{j.name}</strong> · {j.origin} ·{" "}
                {j.mode === "car" ? "자동차" : "대중교통"} ·{" "}
                {j.minutes === null ? "시간 미확인" : `약 ${j.minutes}분`}
                <p className="text-xs">{j.summary || j.warning}</p>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
