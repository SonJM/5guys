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
      <h2 className="text-xl font-bold">어디서 만날까요?</h2>
      <p className="text-sm text-slate-500">
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
        <div className="planner-form">
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
        {people.map((p, i) => (
          <div key={i} className="planner-form">
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
                onClick={() => setPeople(people.filter((_, j) => i !== j))}
              >
                제외
              </button>
            )}
          </div>
        ))}
        <div className="flex gap-4">
          <button
            type="button"
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
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {results.map((p) => (
        <article key={p.id} className="space-y-2 rounded-lg border p-4">
          <h3 className="font-bold">
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600"
            >
              {p.name} ↗
            </a>
          </h3>
          <p className="text-sm text-slate-500">{p.address}</p>
          {p.reason && <p className="text-sm">{p.reason}</p>}
          <ul className="space-y-2">
            {p.journeys.map((j, i) => (
              <li
                key={i}
                className="rounded bg-slate-100 p-2 text-sm text-slate-800"
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
