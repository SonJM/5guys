import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const code = ts.transpileModule(await readFile(new URL('../src/lib/month-cache.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const { MonthCache, adjacentMonths } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('month requests deduplicate, expire and retain stale values', async () => {
  let now = 0, calls = 0, resolve;
  const cache = new MonthCache(120, 6, () => now);
  const fetcher = () => { calls++; return new Promise(r => { resolve = r; }); };
  const first = cache.load('2026-12', fetcher);
  assert.equal(cache.load('2026-12', fetcher), first);
  resolve('old'); await first;
  assert.equal(await cache.load('2026-12', fetcher), 'old'); assert.equal(calls, 1);
  now = 121;
  const refresh = cache.load('2026-12', fetcher);
  assert.equal(cache.peek('2026-12'), 'old');
  resolve('new'); await refresh;
  cache.invalidate(); assert.equal(cache.peek('2026-12'), 'new');
  const reloaded = cache.load('2026-12', fetcher); resolve('latest'); await reloaded;
  assert.equal(calls, 3);
});
test('invalidated in-flight responses cannot overwrite newer data', async () => {
  const cache = new MonthCache(); let finishOld;
  const old = cache.load('2026-10', () => new Promise(r => { finishOld = r; }));
  cache.invalidate();
  assert.equal(await cache.load('2026-10', async () => 'fresh'), 'fresh');
  finishOld('stale'); assert.equal(await old, undefined);
  assert.equal(cache.peek('2026-10'), 'fresh');
});
test('cache has a bounded size, is instance-private and handles year boundaries', async () => {
  const cache = new MonthCache(120000, 2);
  for (const month of ['2026-11', '2026-12', '2027-01']) await cache.load(month, async () => month);
  assert.equal(cache.peek('2026-11'), undefined);
  assert.equal(new MonthCache().peek('2026-12'), undefined);
  assert.deepEqual(adjacentMonths('2026-12'), ['2026-11', '2027-01']);
  assert.deepEqual(adjacentMonths('2027-01'), ['2026-12', '2027-02']);
});
