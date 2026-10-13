"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { confirmGroupPlan, createGroupPlan, listGroupPlans, voteGroupPlan } from "@/app/group-plan-actions";
import { dayString, localInput } from "@/lib/planner";
import { listGroupMembersAction } from "@/app/actions";

export default function GroupPlans({ groupId, userId, selectedDay, suggested, onFindPlace }: {
  groupId: number;
  userId: string;
  selectedDay: string;
  suggested?: { start: string; end: string } | null;
  onFindPlace?: (planId: string) => void;
}) {
  const today = selectedDay || dayString();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"meetup" | "trip">("meetup");
  const [start, setStart] = useState(`${today}T18:00`);
  const [end, setEnd] = useState(`${today}T20:00`);
  const [workspace, setWorkspace] = useState<Awaited<ReturnType<typeof listGroupPlans>>>({ plans: [], isOwner: false, currentUserId: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Awaited<ReturnType<typeof listGroupMembersAction>>>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [dateEdited, setDateEdited] = useState(false);
  const draftKey = `group-plan-draft:${userId}:${groupId}`;
  const previousSuggestion = useRef(suggested);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null');
      if (saved && typeof saved.title === 'string' && ['meetup', 'trip'].includes(saved.kind) && typeof saved.start === 'string' && typeof saved.end === 'string') {
        setTitle(saved.title); setKind(saved.kind); setStart(saved.start); setEnd(saved.end); setDateEdited(!!saved.dateEdited);
      }
    } catch { /* An unavailable browser store must not block editing. */ }
    setDraftReady(true);
  }, [draftKey]);
  useEffect(() => {
    if (!draftReady) return;
    try { sessionStorage.setItem(draftKey, JSON.stringify({ title, kind, start, end, dateEdited })); } catch {}
  }, [draftKey, draftReady, title, kind, start, end, dateEdited]);
  useEffect(() => {
    if (draftReady && !dateEdited) { setStart(`${selectedDay}T18:00`); setEnd(`${selectedDay}T20:00`); }
  }, [selectedDay, dateEdited, draftReady]);
  const reload = useCallback(async () => {
    try {
      const [plans, people] = await Promise.all([listGroupPlans(groupId), listGroupMembersAction(groupId)]);
      setWorkspace(plans); setMembers(people);
    }
    catch (e) { setMessage((e as Error).message); }
    finally { setLoading(false); }
  }, [groupId]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const listener = () => { void reload(); };
    window.addEventListener('planner-synced', listener);
    return () => window.removeEventListener('planner-synced', listener);
  }, [reload]);
  useEffect(() => {
    if (suggested && suggested !== previousSuggestion.current) { setStart(localInput(suggested.start)); setEnd(localInput(suggested.end)); setDateEdited(true); }
    previousSuggestion.current = suggested;
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
      void run(async () => { await createGroupPlan(groupId, title, kind, toIso(start), toIso(end)); setTitle(""); setDateEdited(false); });
    }}>
      <h3 className="font-bold">날짜 후보 제안</h3>
      <input aria-label="계획 이름" required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 부산 주말여행" className="min-w-40 flex-1" />
      <select aria-label="계획 유형" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="meetup">약속</option><option value="trip">여행</option></select>
      <label>시작 <input type="datetime-local" required value={start} onChange={(e) => { setStart(e.target.value); setDateEdited(true); }} /></label>
      <label>종료 <input type="datetime-local" required value={end} onChange={(e) => { setEnd(e.target.value); setDateEdited(true); }} /></label>
      {dateEdited && start.slice(0, 10) !== selectedDay && <p className="w-full text-xs text-[var(--muted)]">입력한 후보 날짜 {start.slice(0, 10)}를 유지하고 있습니다. 달력 선택일은 {selectedDay}입니다.</p>}
      <button disabled={busy} className="primary-button">후보 올리기</button>
    </form>
    {message && <p role="status" className="status-note">{message}</p>}
    {loading ? <p role="status" className="muted text-sm">그룹 계획을 불러오는 중…</p> : !workspace.plans.length && !message && <p className="empty-state text-sm">아직 그룹 계획이 없습니다.<span>달력에서 공통 가능 시간을 고르거나 첫 날짜를 제안해 보세요.</span></p>}
    <div className="grid gap-3 sm:grid-cols-2">
      {workspace.plans.map((plan) => {
        const votes = (plan.group_plan_votes ?? []).filter((vote) => members.some((member) => member.id === vote.user_id));
        const unanswered = members.filter((member) => !votes.some((vote) => vote.user_id === member.id));
        return <article key={plan.id} className="rounded-2xl border border-[var(--line)] p-4">
          <div className="flex flex-wrap items-center gap-2"><span className="eyebrow">{plan.kind === "trip" ? "여행" : "약속"}</span><span className="rounded-full bg-[var(--brand-light)] px-2 py-1 text-xs font-bold text-[var(--brand)]">{plan.status === "confirmed" ? "확정" : "제안 중"}</span></div>
          <h3 className="mt-2 font-extrabold">{plan.title}</h3>
          <p className="muted mt-1 text-sm">{localInput(plan.starts_at).replace("T", " ")} ~ {localInput(plan.ends_at).replace("T", " ")}</p>
          {plan.place_name && <p className="mt-2 text-sm">장소: {plan.place_url ? <a className="brand-link" href={plan.place_url} target="_blank" rel="noopener noreferrer">{plan.place_name} ↗</a> : plan.place_name}</p>}
          <p className="muted mt-2 text-xs">가능 {votes.filter((v) => v.vote === "yes").length} · 미정 {votes.filter((v) => v.vote === "maybe").length} · 어려움 {votes.filter((v) => v.vote === "no").length}</p>
          <p className="muted mt-1 text-xs">{votes.length}/{members.length}명 응답 · 미응답 {unanswered.length}명</p>
          <details className="mt-2 text-xs"><summary className="cursor-pointer">구성원별 의견</summary><ul className="mt-2 space-y-1">{members.map((member) => {
            const vote = votes.find((item) => item.user_id === member.id)?.vote;
            return <li key={member.id}>{member.name} · {vote === 'yes' ? '가능' : vote === 'maybe' ? '미정' : vote === 'no' ? '어려움' : '미응답'}</li>;
          })}</ul></details>
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.status === "proposed" && ([['yes', '가능'], ['maybe', '미정'], ['no', '어려움']] as const).map(([vote, label]) => <button key={vote} type="button" disabled={busy} aria-pressed={votes.some((v) => v.user_id === workspace.currentUserId && v.vote === vote)} className={`secondary-button !min-h-9 !px-3 ${votes.some((v) => v.user_id === workspace.currentUserId && v.vote === vote) ? "!border-[var(--brand)] !bg-[var(--brand-light)]" : ""}`} onClick={() => void run(() => voteGroupPlan(plan.id, vote))}>{label}</button>)}
            {workspace.isOwner && plan.status === "proposed" && <button type="button" disabled={busy} className="primary-button !min-h-9 !px-3" onClick={() => {
              const warning = unanswered.length || votes.some((vote) => vote.vote !== 'yes') ? `미응답 ${unanswered.length}명 · 미정 ${votes.filter((v) => v.vote === 'maybe').length}명 · 어려움 ${votes.filter((v) => v.vote === 'no').length}명입니다. 구성원 의견을 확인해주세요.\n\n` : '';
              if (window.confirm(`${warning}이 계획을 확정할까요? 확정 시간은 그룹 구성원 모두의 공통 가능 시간에서 제외됩니다.`)) void run(async () => {
                await confirmGroupPlan(plan.id);
                window.dispatchEvent(new Event('planner-synced'));
              });
            }}>이 날짜 확정</button>}
            {onFindPlace && <button type="button" className="ghost-button !min-h-9 !px-3" onClick={() => onFindPlace(plan.id)}>장소 추천 보기 →</button>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
