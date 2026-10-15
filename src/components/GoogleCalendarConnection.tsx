"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { requiresGoogleConfiguration, requiresGoogleReconnect } from '@/lib/google-connection';
import { requestCalendarSync, startCalendarAutoSync } from '@/lib/calendar-auto-sync';
export default function GoogleCalendarConnection({ manual = false }: { manual?: boolean }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const inFlight = useRef(false);
  const lastAttempt = useRef(0);
  const [conflicts, setConflicts] = useState<{ id: string; title: string }[]>(
    [],
  );
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/google/sync", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const data = await r.json();
      if (!r.ok) {
        setMessage(data.error ?? "일정 자동 업데이트 상태를 확인하지 못했습니다.");
        return;
      }
      setConnected(data.connected);
      setLastSync(data.last_sync ?? null);
      setMessage(data.last_error ?? "");
      // Conflict display is secondary: it must not block the sync request.
      void Promise.resolve(createClient()
        .from("planner_events")
        .select("id,title")
        .eq("sync_state", "conflict"))
        .then(({ data: rows, error }) => { if (!error) setConflicts(rows ?? []); })
        .catch(() => {});
      return data as { connected: boolean; last_sync?: string | null };
    } catch {
      setMessage("일정 자동 업데이트 상태를 확인하지 못했습니다.");
    }
  }, []);
  const sync = useCallback(async (force = false) => {
    if (inFlight.current || (!force && Date.now() - lastAttempt.current < 15000)) return;
    inFlight.current = true;
    lastAttempt.current = Date.now();
    setBusy(true);
    setCompleted(false);
    setMessage('');
    try {
      await requestCalendarSync();
      const connection = await refresh();
      if (force && connection?.connected) setCompleted(true);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [refresh]);
  useEffect(() => {
    // Account settings offer explicit actions without starting background sync.
    if (manual) {
      void refresh();
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const error = params.get("calendarError");
    // A callback notice belongs to this visit, not every future refresh.
    if (error) {
      params.delete('calendarError');
      const query = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }
    let callbackMessage = error;
    return startCalendarAutoSync(async () => {
      const connection = await refresh();
      if (callbackMessage) {
        setMessage(callbackMessage);
        callbackMessage = null;
      }
      // Even a failed initial lookup is retried on the next tick/focus/online.
      if (connection?.connected) await sync();
    });
  }, [manual, refresh, sync]);
  async function resolve(id: string, keepCopy: boolean) {
    setBusy(true);
    try {
      const r = await fetch("/api/google/conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, keepCopy }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await sync();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!manual && connected === null && !message && !conflicts.length && !busy) return null;
  const needsReconnect = connected === false || requiresGoogleReconnect(message);
  const needsConfiguration = requiresGoogleConfiguration(message);
  return (
    <div className={`space-y-3 text-sm ${manual ? '' : 'px-5 lg:px-0'}`}>
      {!message && (connected || manual) && <p role="status" className="muted text-xs">{busy ? '일정을 업데이트하고 있어요…' : connected === null ? '캘린더 연결 상태를 확인하고 있어요…' : lastSync ? `마지막 업데이트: ${new Date(lastSync).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}` : '아직 완료된 업데이트가 없습니다.'}</p>}
      {manual && <div className="flex flex-wrap gap-3"><button type="button" className="primary-button" disabled={busy || connected === false} onClick={() => void sync(true)}>{busy ? '업데이트 중…' : '지금 업데이트'}</button>{busy ? <span className="secondary-button opacity-50" aria-disabled="true">Google 캘린더 다시 연결</span> : <a className="secondary-button" href="/api/google/connect">Google 캘린더 다시 연결</a>}</div>}
      {manual && completed && !message && <p role="status" className="status-note">캘린더 업데이트를 완료했어요.</p>}
      {(message || connected === false) && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"><div><p>{needsConfiguration ? '일정 자동 업데이트가 중단되어 있어요. 서비스 설정 확인이 필요합니다.' : needsReconnect ? '일정 자동 업데이트 연결이 필요해요.' : '일정 자동 업데이트가 지연되고 있어요. 잠시 후 다시 시도합니다.'}</p>{message && <p className="mt-1 text-xs">{message}</p>}<p className="mt-1 text-xs">저장된 일정 확인과 앱 일정 등록은 이용할 수 있어요. 외부에서 바꾼 일정은 아직 반영되지 않을 수 있습니다.</p><p className="mt-1 text-xs">{lastSync ? `마지막 업데이트: ${new Date(lastSync).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}` : '아직 완료된 자동 업데이트가 없습니다.'}</p></div>{needsReconnect && !needsConfiguration && <a href="/api/google/connect" className="font-bold underline underline-offset-2">연결 복구</a>}</div>}
      {conflicts.map((c) => (
        <div
          key={c.id}
          className="flex flex-wrap items-center gap-3 rounded-xl bg-[#fff5e6] p-3 text-[#78512b] dark:bg-[#493522] dark:text-[#f9d7aa]"
        >
          <span>{c.title}: 다른 곳에서도 변경됨</span>
          <button className="secondary-button !min-h-9" disabled={busy} onClick={() => void resolve(c.id, false)}>
            다른 곳의 변경 적용
          </button>
          <button className="secondary-button !min-h-9" disabled={busy} onClick={() => void resolve(c.id, true)}>
            내 수정본도 별도 보관
          </button>
        </div>
      ))}
    </div>
  );
}
