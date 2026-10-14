"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { requiresGoogleReconnect } from '@/lib/google-connection';
export default function GoogleCalendarConnection() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const inFlight = useRef(false);
  const lastAttempt = useRef(0);
  const [conflicts, setConflicts] = useState<{ id: string; title: string }[]>(
    [],
  );
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/google/sync", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) {
        setMessage(data.error ?? "일정 자동 업데이트 상태를 확인하지 못했습니다.");
        return;
      }
      setConnected(data.connected);
      setLastSync(data.last_sync ?? null);
      setMessage(data.last_error ?? "");
      const { data: rows } = await createClient()
        .from("planner_events")
        .select("id,title")
        .eq("sync_state", "conflict");
      setConflicts(rows ?? []);
      return data as { connected: boolean; last_sync?: string | null };
    } catch {
      setMessage("일정 자동 업데이트 상태를 확인하지 못했습니다.");
    }
  }, []);
  const sync = useCallback(async () => {
    if (inFlight.current || Date.now() - lastAttempt.current < 15000) return;
    inFlight.current = true;
    lastAttempt.current = Date.now();
    setBusy(true);
    try {
      const r = await fetch("/api/google/sync", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      await refresh();
      if (data.changed ?? (data.imported + data.exported + data.conflicts > 0))
        window.dispatchEvent(new Event("planner-synced"));
      else window.dispatchEvent(new Event('planner-refresh'));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [refresh]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("calendarError");
    // A callback notice belongs to this visit, not every future refresh.
    if (error) {
      params.delete('calendarError');
      const query = params.toString();
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }
    void refresh().then((connection) => {
      if (error) setMessage(error);
      if (
        !error &&
        connection?.connected
      )
        void sync();
    });
  }, [refresh, sync]);
  useEffect(() => {
    if (!connected) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, 120000);
    return () => clearInterval(id);
  }, [connected, sync]);
  useEffect(() => {
    const onLocalChange = () => { if (!busy && connected) void sync(); };
    const onVisible = () => { if (document.visibilityState === 'visible' && !busy && connected) void sync(); };
    window.addEventListener('planner-local-change', onLocalChange);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('planner-local-change', onLocalChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [busy, connected, sync]);
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
  if (connected === null && !message && !conflicts.length) return null;
  if (connected && !message && !conflicts.length) return null;
  const needsReconnect = connected === false || requiresGoogleReconnect(message);
  return (
    <div className="space-y-3 px-5 text-sm lg:px-0">
      {message && <p role="alert" className="status-note">{message}</p>}
      {(message || connected === false) && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"><div><p>{needsReconnect ? '일정 자동 업데이트 연결이 필요해요.' : '일정 자동 업데이트가 지연되고 있어요. 잠시 후 다시 시도합니다.'}</p><p className="mt-1 text-xs">저장된 일정 확인과 앱 일정 등록은 이용할 수 있어요. 외부에서 바꾼 일정은 아직 반영되지 않을 수 있습니다.</p><p className="mt-1 text-xs">{lastSync ? `마지막 업데이트: ${new Date(lastSync).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}` : '아직 완료된 자동 업데이트가 없습니다.'}</p></div>{needsReconnect && <a href="/api/google/connect" className="font-bold underline underline-offset-2">연결 복구</a>}</div>}
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
