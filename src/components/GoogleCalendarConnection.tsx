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
    <div className="mb-4 space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <strong>Google Calendar</strong>
        <a href="/api/google/connect" className="text-blue-600 underline">
          {connected ? "다시 연결" : "캘린더 연결"}
        </a>
        {connected && (
          <button disabled={busy} onClick={() => void sync()}>
            {busy ? "동기화 중…" : "지금 동기화"}
          </button>
        )}
        <span className="text-slate-500">
          기본 캘린더 · 양방향 · 화면 사용 중 2분 간격
        </span>
      </div>
      {message && <p role="status">{message}</p>}
      {conflicts.map((c) => (
        <div
          key={c.id}
          className="flex flex-wrap gap-3 rounded bg-amber-50 p-2 text-amber-900"
        >
          <span>{c.title}: 양쪽에서 변경됨</span>
          <button disabled={busy} onClick={() => void resolve(c.id, false)}>
            Google 내용 적용
          </button>
          <button disabled={busy} onClick={() => void resolve(c.id, true)}>
            내 수정본도 별도 보관
          </button>
        </div>
      ))}
    </div>
  );
}
