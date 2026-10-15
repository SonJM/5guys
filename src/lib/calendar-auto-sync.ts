type SyncEnvironment = {
  window: Pick<Window, 'addEventListener' | 'removeEventListener' | 'setInterval' | 'clearInterval'>;
  document: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
};

export async function requestCalendarSync(
  fetcher: typeof fetch = fetch,
  notify = () => { window.dispatchEvent(new Event('planner-synced')); },
) {
  const response = await fetcher('/api/google/sync', {
    method: 'POST', signal: AbortSignal.timeout(290000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '일정 자동 업데이트에 실패했습니다.');
  // Changes may have been applied by a webhook/another device before this POST.
  // Refresh the browser's cached calendar even when this request changed zero rows.
  notify();
}

// Start retries independently of the first connection lookup. A temporary
// session/network error must not permanently disable automatic updates.
export function startCalendarAutoSync(
  run: () => Promise<void>,
  environment: SyncEnvironment = { window, document },
) {
  const { window: target, document: page } = environment;
  let active = true;
  let running = false;
  const attempt = async () => {
    if (!active || running || page.visibilityState !== 'visible') return;
    running = true;
    try { await run(); }
    catch { /* The caller displays errors; future ticks still retry. */ }
    finally { running = false; }
  };
  const listener = () => { void attempt(); };
  const timer = target.setInterval(listener, 120000);
  target.addEventListener('focus', listener);
  target.addEventListener('online', listener);
  target.addEventListener('planner-local-change', listener);
  page.addEventListener('visibilitychange', listener);
  listener();
  return () => {
    active = false;
    target.clearInterval(timer);
    target.removeEventListener('focus', listener);
    target.removeEventListener('online', listener);
    target.removeEventListener('planner-local-change', listener);
    page.removeEventListener('visibilitychange', listener);
  };
}
