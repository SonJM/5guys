"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
export default function GoogleCalendarConnection() {
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<{ id: string; title: string }[]>(
    [],
  );
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/google/sync");
      const data = await r.json();
      if (!r.ok) {
        setMessage(data.error);
        return;
      }
      setConnected(data.connected);
      setMessage(
        data.last_error ??
          (data.last_sync
            ? `마지막 동기화: ${new Date(data.last_sync).toLocaleString("ko-KR")}`
            : ""),
      );
      const { data: rows } = await createClient()
        .from("planner_events")
        .select("id,title")
        .eq("sync_state", "conflict");
      setConflicts(rows ?? []);
      return data as { connected: boolean; last_sync?: string | null };
    } catch {
      setMessage("Google 연결 상태를 확인하지 못했습니다.");
    }
  }, []);
  const sync = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/google/sync", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      await refresh();
      setMessage(
        `가져오기 ${data.imported}건 · 반영 ${data.exported}건 · 충돌 ${data.conflicts}건`,
      );
      window.dispatchEvent(new Event("planner-synced"));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("calendarError");
    if (error) setMessage(error);
    void refresh().then((connection) => {
      if (
        !error &&
        connection?.connected &&
        (!connection.last_sync ||
          Date.now() - Date.parse(connection.last_sync) > 120000)
      )
        void sync();
    });
  }, [refresh, sync]);
  useEffect(() => {
    if (!connected) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && !busy) void sync();
    }, 120000);
    return () => clearInterval(id);
  }, [connected, busy, sync]);
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
  return (
    <div className="surface-card space-y-3 !rounded-2xl !shadow-none p-4 sm:p-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-light)] text-lg font-black text-[var(--brand)]" aria-hidden="true">G</span>
          <div><strong className="block">Google Calendar</strong><span className="muted text-xs">기본 캘린더와 양방향 동기화</span></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? 'bg-[var(--brand-light)] text-[var(--brand)]' : 'bg-[var(--surface-soft)] text-[var(--muted)]'}`}>{connected ? '연결됨' : '연결 전'}</span>
          <a href="/api/google/connect" className="secondary-button !min-h-9 !px-3">{connected ? "다시 연결" : "캘린더 연결"}</a>
          {connected && <button className="primary-button !min-h-9 !px-3" disabled={busy} onClick={() => void sync()}>{busy ? "동기화 중…" : "지금 동기화"}</button>}
        </div>
      </div>
      {message && <p role="status" className="muted text-xs">{message}</p>}
      {conflicts.map((c) => (
        <div
          key={c.id}
          className="flex flex-wrap items-center gap-3 rounded-xl bg-[#fff5e6] p-3 text-[#78512b] dark:bg-[#493522] dark:text-[#f9d7aa]"
        >
          <span>{c.title}: 양쪽에서 변경됨</span>
          <button className="secondary-button !min-h-9" disabled={busy} onClick={() => void resolve(c.id, false)}>
            Google 내용 적용
          </button>
          <button className="secondary-button !min-h-9" disabled={busy} onClick={() => void resolve(c.id, true)}>
            내 수정본도 별도 보관
          </button>
        </div>
      ))}
    </div>
  );
}
