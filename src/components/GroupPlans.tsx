"use client";
import { useCallback, useEffect, useState } from "react";
import { confirmGroupPlan, createGroupPlan, listGroupPlans, voteGroupPlan } from "@/app/group-plan-actions";
import { dayString, localInput } from "@/lib/planner";

export default function GroupPlans({ groupId, suggested, onFindPlace }: {
  groupId: number;
  suggested?: { start: string; end: string } | null;
  onFindPlace?: (planId: string) => void;
}) {
  const today = dayString();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"meetup" | "trip">("meetup");
  const [start, setStart] = useState(`${today}T18:00`);
  const [end, setEnd] = useState(`${today}T20:00`);
  const [workspace, setWorkspace] = useState<Awaited<ReturnType<typeof listGroupPlans>>>({ plans: [], isOwner: false, currentUserId: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    try { setWorkspace(await listGroupPlans(groupId)); }
    catch (e) { setMessage((e as Error).message); }
  }, [groupId]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (suggested) { setStart(localInput(suggested.start)); setEnd(localInput(suggested.end)); }
  }, [suggested]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); await reload(); setMessage("그룹에 반영했습니다."); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  const toIso = (value: string) => new Date(`${value}:00+09:00`).toISOString();
  return <section className="space-y-4 border-t border-[var(--line)] pt-6">
    <div><h2 className="text-xl font-extrabold">함께 정하는 약속·여행</h2><p className="muted mt-1 text-sm">구성원 누구나 날짜를 제안하고 의견을 남길 수 있어요. 그룹 생성자가 확정한 일정은 그룹 달력의 바쁜 시간에 반영됩니다.</p></div>
    <form id="group-plan-form" className="planner-form scroll-mt-5 rounded-2xl bg-[var(--surface-soft)] p-4" onSubmit={(event) => {
      event.preventDefault();
      void run(async () => { await createGroupPlan(groupId, title, kind, toIso(start), toIso(end)); setTitle(""); });
    }}>
      <h3 className="font-bold">날짜 후보 제안</h3>
      <input aria-label="계획 이름" required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 부산 주말여행" className="min-w-40 flex-1" />
      <select aria-label="계획 유형" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="meetup">약속</option><option value="trip">여행</option></select>
      <label>시작 <input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} /></label>
      <label>종료 <input type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      <button disabled={busy} className="primary-button">후보 올리기</button>
    </form>
    {message && <p role="status" className="status-note">{message}</p>}
    {!workspace.plans.length && <p className="empty-state text-sm">아직 그룹 계획이 없습니다.<span>달력에서 공통 가능 시간을 고르거나 첫 날짜를 제안해 보세요.</span></p>}
    <div className="grid gap-3 sm:grid-cols-2">
      {workspace.plans.map((plan) => {
        const votes = plan.group_plan_votes ?? [];
        return <article key={plan.id} className="rounded-2xl border border-[var(--line)] p-4">
          <div className="flex flex-wrap items-center gap-2"><span className="eyebrow">{plan.kind === "trip" ? "여행" : "약속"}</span><span className="rounded-full bg-[var(--brand-light)] px-2 py-1 text-xs font-bold text-[var(--brand)]">{plan.status === "confirmed" ? "확정" : "제안 중"}</span></div>
          <h3 className="mt-2 font-extrabold">{plan.title}</h3>
          <p className="muted mt-1 text-sm">{localInput(plan.starts_at).replace("T", " ")} ~ {localInput(plan.ends_at).replace("T", " ")}</p>
          {plan.place_name && <p className="mt-2 text-sm">장소: {plan.place_url ? <a className="brand-link" href={plan.place_url} target="_blank" rel="noopener noreferrer">{plan.place_name} ↗</a> : plan.place_name}</p>}
          <p className="muted mt-2 text-xs">가능 {votes.filter((v) => v.vote === "yes").length} · 미정 {votes.filter((v) => v.vote === "maybe").length} · 어려움 {votes.filter((v) => v.vote === "no").length}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.status === "proposed" && ([['yes', '가능'], ['maybe', '미정'], ['no', '어려움']] as const).map(([vote, label]) => <button key={vote} type="button" disabled={busy} aria-pressed={votes.some((v) => v.user_id === workspace.currentUserId && v.vote === vote)} className={`secondary-button !min-h-9 !px-3 ${votes.some((v) => v.user_id === workspace.currentUserId && v.vote === vote) ? "!border-[var(--brand)] !bg-[var(--brand-light)]" : ""}`} onClick={() => void run(() => voteGroupPlan(plan.id, vote))}>{label}</button>)}
            {workspace.isOwner && plan.status === "proposed" && <button type="button" disabled={busy} className="primary-button !min-h-9 !px-3" onClick={() => { if (window.confirm("이 계획을 확정할까요? 확정 시간은 그룹 구성원 모두의 공통 가능 시간에서 제외됩니다.")) void run(() => confirmGroupPlan(plan.id)); }}>이 날짜 확정</button>}
            {onFindPlace && <button type="button" className="ghost-button !min-h-9 !px-3" onClick={() => onFindPlace(plan.id)}>장소 추천 보기 →</button>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
