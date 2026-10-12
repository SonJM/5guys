"use client";
import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function CalendarChangeListener({ userId }: { userId: string }) {
  useEffect(() => {
    const db = createClient();
    let timer: number | undefined;
    let connected = false;
    const channel = db.channel(`my-calendar:${userId}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'planner_events', filter: `user_id=eq.${userId}`,
    }, () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        window.dispatchEvent(new Event('planner-synced'));
      }, 500);
    }).subscribe((status) => {
      // Re-read after reconnect: updates may have happened while disconnected.
      if (status === 'SUBSCRIBED') {
        if (connected) window.dispatchEvent(new Event('planner-synced'));
        connected = true;
      }
    });
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      void db.removeChannel(channel);
    };
  }, [userId]);
  return null;
}
