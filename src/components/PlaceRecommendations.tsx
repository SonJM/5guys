"use client";
import { useEffect, useState } from "react";
import { listGroupPlans, setGroupPlanPlace } from "@/app/group-plan-actions";
import { localInput } from "@/lib/planner";
import { listGroupMembersAction } from "@/app/actions";
type Candidate = {
  id: string;
  name: string;
  address: string;
  url: string;
  reason: string;
  verified: boolean;
  journeys: {
    name: string;
    origin: string;
    mode: string;
    minutes: number | null;
    summary: string;
    warning: string;
    url: string;
  }[];
};
const placeCategories: Record<string, string> = { cafe: '카페', dinner: '음식점', drinks: '술집', trip: '관광명소', custom: '직접 입력' };
export default function PlaceRecommendations({ groupId, planId, onBackToGroup }: { groupId: number | null; planId: string | null; onBackToGroup?: () => void }) {
  const [type, setType] = useState("cafe");
  const [region, setRegion] = useState("");
  const [keyword, setKeyword] = useState('');
  const [people, setPeople] = useState<{ name: string; origin: string; mode: string; memberId?: string }[]>([
    { name: "나", origin: "", mode: "transit" },
  ]);
  const [results, setResults] = useState<Candidate[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [targetPlan, setTargetPlan] = useState<{ id: string; title: string; starts_at: string; ends_at: string; canSave: boolean } | null>(null);
  const [service, setService] = useState<{ search: boolean; car: boolean; transit: boolean } | null>(null);
  const [serviceError, setServiceError] = useState('');
  const [searchError, setSearchError] = useState(false);
  const [members, setMembers] = useState<Awaited<ReturnType<typeof listGroupMembersAction>>>([]);
  const [snapshot, setSnapshot] = useState<{ key: string; label: string; at: string } | null>(null);
  const conditions = JSON.stringify({ type, keyword, region, participants: people });
  const stale = !!snapshot && snapshot.key !== conditions;
  async function checkService() {
    setServiceError('');
    try {
      const response = await fetch('/api/places', { cache: 'no-store' });
      if (!response.ok) throw new Error('장소 추천 상태를 확인하지 못했습니다.');
      setService(await response.json());
    } catch { setServiceError('장소 추천 상태를 확인하지 못했습니다. 다시 확인해주세요.'); }
  }
  useEffect(() => { void checkService(); }, []);
  useEffect(() => {
    let alive = true;
    setTargetPlan(null);
    setMembers([]);
    const id = planId;
    if (!id || !groupId) return;
    listGroupMembersAction(groupId).then((data) => { if (alive) setMembers(data); }).catch(() => { if (alive) setMessage('그룹 참여자를 불러오지 못했습니다. 직접 입력하거나 다시 시도해주세요.'); });
    listGroupPlans(groupId).then(({ plans, isOwner }) => {
      const plan = plans.find((p) => p.id === id);
      if (alive && plan) {
        setTargetPlan({ id, title: plan.title, starts_at: plan.starts_at, ends_at: plan.ends_at, canSave: isOwner });
        setType(plan.kind === 'trip' ? 'trip' : 'cafe');
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [groupId, planId]);
  async function savePlace(candidate: Candidate) {
    if (!targetPlan || !groupId) return;
    setBusy(true);
    try {
      await setGroupPlanPlace(targetPlan.id, groupId, candidate.name, candidate.url);
      setMessage(`${targetPlan.title}의 장소를 ${candidate.name}(으)로 저장했습니다.`);
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  async function search() {
    const request = conditions;
    const label = `${region.trim()} · ${keyword.trim() || placeCategories[type]} · ${people.map((person) => `${person.name}: ${person.origin} (${person.mode === 'car' ? '자동차' : '대중교통'})`).join(' / ')}`;
    setBusy(true);
    setMessage("");
    setResults([]);
    setSearchError(false);
    setSnapshot(null);
    try {
      const r = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: request,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResults(data.results);
      setSnapshot({ key: request, label, at: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) });
      setMessage(
        `${data.ai ? "AI 추천 설명 포함 · " : ""}${data.note}${data.results.length ? "" : " 검색 결과가 없습니다."}`,
      );
    } catch (e) {
      setSearchError(true);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="place-form space-y-5">
      <h2 className="text-xl font-extrabold">모두에게 편한 장소 찾기</h2>
      <p className="muted text-sm leading-6">
        국내 장소를 검색하고 구성원별 이동 시간을 비교합니다. 출발지는 이번
        검색에만 사용하며 그룹에 저장하지 않습니다.
      </p>
      {targetPlan && <div className="status-note"><p>그룹 계획 「{targetPlan.title}」의 장소를 찾고 있어요.</p><p className="mt-1 text-xs">{localInput(targetPlan.starts_at).replace('T', ' ')} ~ {localInput(targetPlan.ends_at).replace('T', ' ')}</p>{onBackToGroup && <button type="button" className="brand-link mt-2 text-xs" onClick={onBackToGroup}>그룹 계획으로 돌아가기 →</button>}</div>}
      {service?.search === false && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">장소 추천을 준비 중입니다. 지금은 아래 지도 검색으로 장소를 확인할 수 있어요.</p>}
      {serviceError && <p role="alert" className="text-sm text-[#a54036]">{serviceError} <button type="button" className="brand-link" onClick={() => void checkService()}>상태 다시 확인</button></p>}
      {service?.search && (!service.car || !service.transit) && <p className="muted text-xs">{!service.car && '자동차 이동 시간'}{!service.car && !service.transit && ' · '}{!service.transit && '대중교통 이동 시간'} 조회를 준비 중입니다. 장소 검색은 이용할 수 있어요.</p>}
      <form
        id="place-search-form"
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
            <option value="dinner">식사</option>
            <option value="drinks">술</option>
            <option value="trip">국내 여행</option>
            <option value="custom">직접 입력</option>
          </select>
          <input
            aria-label="희망 지역"
            required
            placeholder="희망 지역: 성수동, 부산 등"
            maxLength={80}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
          <label className="min-w-0">찾을 장소 키워드 {type === 'custom' ? '(필수)' : '(선택)'}<input required={type === 'custom'} maxLength={80} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="예: 전시, 볼링, 보드게임" /></label>
        </div>
        <h3 className="text-sm font-extrabold">출발지와 이동수단</h3>
        {targetPlan && members.length > 0 && <div className="rounded-xl bg-[var(--surface-soft)] p-3"><p className="mb-2 text-xs">그룹 구성원을 선택해 추가하세요. 출발지는 각자 확인한 장소를 입력합니다. 최대 8명까지 비교할 수 있어요.</p><div className="flex flex-wrap gap-2">{members.map((member) => <button key={member.id} type="button" disabled={busy || people.length >= 8 || people.some((person) => person.memberId === member.id)} className="secondary-button !min-h-9 !px-3" onClick={() => setPeople([...people.filter((person) => !(person.name === '나' && !person.origin)), { name: member.name, memberId: member.id, origin: '', mode: 'transit' }])}>{member.name} 추가</button>)}</div></div>}
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
          <button disabled={busy || !service?.search} className="primary-button w-full sm:w-auto">
            {busy ? "장소와 이동 시간 비교 중…" : service ? '장소 추천받기' : '연결 상태 확인 중…'}
          </button>
          <a className="secondary-button" href={`https://map.kakao.com/?q=${encodeURIComponent(`${region.trim()} ${keyword.trim() || (type === 'custom' ? '' : placeCategories[type])}`)}`} target="_blank" rel="noopener noreferrer">현재 입력으로 지도에서 찾기 ↗</a>
        </div>
      </form>
      {message && (
        <p role={searchError ? 'alert' : 'status'} className={searchError ? 'rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950 dark:text-red-100' : 'status-note'}>
          {message}
        </p>
      )}
      {snapshot && <div className="status-note"><p className="text-sm">적용된 검색 조건: {snapshot.label}</p><p className="mt-1 text-xs">{snapshot.at} 조회 기준 예상 이동 시간입니다. 약속 당일의 교통·운행·영업시간은 별도로 확인해주세요.</p>{stale && <p role="status" className="mt-2 font-bold">조건이 바뀌었습니다. 아래는 이전 검색 결과입니다. <button type="submit" form="place-search-form" disabled={busy} className="brand-link">다시 검색</button></p>}</div>}
      {results.map((p, index) => (
        <article key={p.id} className="space-y-3 rounded-2xl border border-[var(--line)] p-5">
          <span className="eyebrow">{p.verified ? `추천 후보 ${index + 1}` : '경로 확인 필요'}</span>
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
          {targetPlan?.canSave && <button type="button" disabled={busy || stale} className="primary-button !min-h-9" onClick={() => void savePlace(p)}>이 장소를 그룹 계획에 저장</button>}
          <p className="muted text-sm">{p.address}</p>
          {p.reason && <p className="text-sm">{p.reason}</p>}
          <div className="flex flex-wrap gap-2 text-xs">{p.journeys.map((journey, i) => <span key={i} className="rounded-lg bg-[var(--surface-soft)] px-2 py-1">{journey.name} · {journey.minutes === null ? '시간 미확인' : `약 ${journey.minutes}분`}</span>)}</div>
          {p.journeys.length > 0 && p.journeys.every((journey) => journey.minutes !== null) ? <p className="text-xs font-bold">최장 약 {Math.max(...p.journeys.map((journey) => journey.minutes!))}분 · 참여자 간 차이 약 {Math.max(...p.journeys.map((journey) => journey.minutes!)) - Math.min(...p.journeys.map((journey) => journey.minutes!))}분</p> : <p className="muted text-xs">미확인 경로가 있어 전체 이동 시간의 차이를 비교할 수 없습니다.</p>}
          <details><summary className="cursor-pointer text-sm font-bold">경로 자세히</summary><ul className="mt-3 space-y-2">
            {p.journeys.map((j, i) => (
              <li
                key={i}
                className="rounded-xl bg-[var(--surface-soft)] p-3 text-sm"
              >
                <strong>{j.name}</strong> · {j.origin} ·{" "}
                {j.mode === "car" ? "자동차" : "대중교통"} ·{" "}
                {j.minutes === null ? "시간 미확인" : `약 ${j.minutes}분`}
                <p className="text-xs">{j.summary || j.warning}</p>
                {j.url && <a href={j.url} target="_blank" rel="noopener noreferrer" className="brand-link mt-2 inline-block text-xs">카카오맵에서 길찾기 ↗</a>}
              </li>
            ))}
          </ul></details>
        </article>
      ))}
    </section>
  );
}
