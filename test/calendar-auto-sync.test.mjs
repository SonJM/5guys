import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = ts.transpileModule(await readFile(new URL('../src/lib/calendar-auto-sync.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { startCalendarAutoSync, requestCalendarSync } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const flush = () => new Promise(resolve => setImmediate(resolve));

function environment() {
  const target = new EventTarget();
  const page = new EventTarget();
  page.visibilityState = 'visible';
  const timers = new Map();
  let id = 0;
  target.setInterval = (callback, delay) => { timers.set(++id, { callback, delay }); return id; };
  target.clearInterval = key => timers.delete(key);
  return {
    window: target, document: page, timers,
    tick() { for (const timer of timers.values()) timer.callback(); },
  };
}

test('dashboard entry runs immediately and a failed first lookup still retries every two minutes', async () => {
  const env = environment();
  let attempts = 0;
  let syncs = 0;
  const stop = startCalendarAutoSync(async () => {
    if (++attempts === 1) throw new Error('temporary session lookup failure');
    syncs++;
  }, env);
  await flush();
  assert.equal(attempts, 1);
  assert.equal(syncs, 0);
  assert.equal([...env.timers.values()][0].delay, 120000);
  env.tick(); await flush();
  assert.equal(attempts, 2);
  assert.equal(syncs, 1);
  env.tick(); await flush();
  assert.equal(syncs, 2);
  stop();
});

test('focus, restored network and local changes recover without reloading; hidden pages wait until visible', async () => {
  const env = environment();
  let runs = 0;
  const stop = startCalendarAutoSync(async () => { runs++; }, env);
  await flush();
  for (const name of ['focus', 'online', 'planner-local-change']) {
    env.window.dispatchEvent(new Event(name)); await flush();
  }
  assert.equal(runs, 4);
  env.document.visibilityState = 'hidden';
  env.tick(); await flush();
  assert.equal(runs, 4);
  env.document.visibilityState = 'visible';
  env.document.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(runs, 5);
  stop();
  assert.equal(env.timers.size, 0);
  env.window.dispatchEvent(new Event('focus')); await flush();
  env.document.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(runs, 5);
});

test('connection lookup returning no connection is polled again instead of disabling the scheduler', async () => {
  const env = environment();
  let connected = false;
  let syncs = 0;
  const stop = startCalendarAutoSync(async () => { if (connected) syncs++; }, env);
  await flush();
  assert.equal(syncs, 0);
  connected = true;
  env.tick(); await flush();
  assert.equal(syncs, 1);
  stop();
});

test('focus and timer events cannot overlap an active sync', async () => {
  const env = environment();
  let finish;
  let runs = 0;
  const stop = startCalendarAutoSync(() => { runs++; return new Promise(resolve => { finish = resolve; }); }, env);
  env.tick();
  env.window.dispatchEvent(new Event('focus'));
  assert.equal(runs, 1);
  finish(); await flush();
  env.tick();
  assert.equal(runs, 2);
  finish(); await flush(); stop();
});

test('successful zero-change sync still refreshes calendars updated earlier by a webhook', async () => {
  let refreshes = 0;
  await requestCalendarSync(async (path, options) => {
    assert.equal(path, '/api/google/sync');
    assert.equal(options.method, 'POST');
    assert.ok(options.signal);
    return Response.json({ changed: false, imported: 0, exported: 0, conflicts: 0 });
  }, () => { refreshes++; });
  assert.equal(refreshes, 1);
});

test('failed sync never emits a successful refresh event', async () => {
  let refreshes = 0;
  await assert.rejects(requestCalendarSync(async () => Response.json({ error: 'refresh failed' }, { status: 400 }),
    () => { refreshes++; }), /refresh failed/);
  assert.equal(refreshes, 0);
});
