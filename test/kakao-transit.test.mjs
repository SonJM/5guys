import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const moduleURL = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const transitURL = moduleURL(await compile('../src/lib/kakao-transit.ts'));
const { parseKakaoTransit, fetchKakaoTransit, kakaoDirectionsUrl, journeyScore } = await import(transitURL);
const origin = {x: '127.1', y: '37.4', place_name: '출발 / 역'}, destination = {x: '129.1', y: '35.1', place_name: '부산 카페'};
const route = (seconds, steps = [{properties: {type: 'WALKING', time: 120}}, {properties: {type: 'SUBWAY', time: seconds - 120, guidance: '2호선 · 승차역 → 하차역'}}]) => ({properties: {totalTime: seconds, transfers: 1}, steps});
test('Kakao seconds convert to minutes; shortest complete route includes walking and transit', () => {
  const data = parseKakaoTransit({status: 'OK', routes: [route(3600), route(1801), {properties: {totalTime: 20}, steps: []}]});
  assert.equal(data.minutes, 31);
  assert.match(data.summary, /도보 2분/);
  assert.match(data.summary, /2호선/);
});
test('no result, malformed and incomplete routes never become a zero-minute estimate', () => {
  for (const data of [null, {status: 'NO_RESULTS'}, {status: 'OK', routes: []}, {status: 'OK', routes: [route(0)]}, {status: 'OK', routes: [route(100, [{properties: {type: 'BUS'}}])]}, {status: 'OK', routes: [route(NaN)]}, {status: 'OK', routes: [route(100, [null])]}]) assert.throws(() => parseKakaoTransit(data));
  assert.equal(journeyScore([{minutes: 30}, {minutes: null}]), Infinity);
  assert.equal(journeyScore([{minutes: NaN}]), Infinity);
  assert.equal(journeyScore([{minutes: 0}]), Infinity);
  assert.equal(journeyScore([]), Infinity);
  assert.equal(journeyScore([{minutes: 10}, {minutes: 30}]), 30);
});
test('route summary handles vehicle and stop names without guidance', () => {
  const result = parseKakaoTransit({status: 'OK', routes: [route(600, [{properties: {type: 'BUS', time: 600, vehicles: [{name: '100번'}], stops: [{name: '서울역'}, {name: '시청'}]}}])]});
  assert.match(result.summary, /버스 100번 · 서울역 → 시청/);
});
test('Kakao request authenticates with REST key and includes both full coordinates', async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(input);
      assert.equal(url.origin, 'https://dapi.kakao.com');
      assert.equal(url.pathname, '/v2/routing/publictraffic');
      assert.equal(url.searchParams.get('start_x'), origin.x);
      assert.equal(url.searchParams.get('end_y'), destination.y);
      assert.equal(url.searchParams.has('apiKey'), false);
      assert.equal(init.headers.Authorization, 'KakaoAK test-key');
      return Response.json({status: 'OK', routes: [route(3600)]});
    };
    assert.equal((await fetchKakaoTransit(origin, destination, 'test-key')).minutes, 60);
  } finally {globalThis.fetch = oldFetch;}
});
test('auth, quota and upstream failures have actionable messages', async () => {
  const oldFetch = globalThis.fetch;
  try {
    for (const [status, message] of [[401, /연결 설정/], [403, /연결 설정/], [429, /조회 한도/], [500, /조회에 실패/]]) {
      globalThis.fetch = async () => new Response(null, {status});
      await assert.rejects(fetchKakaoTransit(origin, destination, 'test-key'), message);
    }
  } finally {globalThis.fetch = oldFetch;}
});
test('fallback route links are Kakao HTTPS links with correctly escaped point names', () => {
  const url = new URL(kakaoDirectionsUrl(origin, destination, 'transit'));
  assert.equal(url.origin, 'https://map.kakao.com');
  assert.ok(url.pathname.startsWith('/link/by/traffic/'));
  assert.ok(url.pathname.includes('%2F'));
  assert.ok(url.pathname.includes(',37.4,127.1'));
  assert.match(kakaoDirectionsUrl(origin, destination, 'car'), /\/link\/by\/car\//);
});
const next = moduleURL('export const NextResponse={json:(data,init)=>Response.json(data,init)}');
const server = moduleURL('export async function session(){return {db:{},user:{id:"test"}}} export async function limited(){} export function apiError(error){return Response.json({error:error.message},{status:400})}');
const openai = moduleURL('export async function structuredCompletion(config){globalThis.__placeAIInput=JSON.parse(config.input);return {reasons:[{id:"fast",reason:"confirmed"},{id:"unknown",reason:"must not appear"}]}}');
const places = await import(moduleURL((await compile('../src/app/api/places/route.ts')).replace('"next/server"', JSON.stringify(next)).replace('"@/lib/server"', JSON.stringify(server)).replace('"@/lib/openai"', JSON.stringify(openai)).replace(/['"]@\/lib\/kakao-transit['"]/, JSON.stringify(transitURL))));
test('places API uses Kakao for transit, ranks only complete estimates, and limits AI to verified candidates', async () => {
  const oldFetch = globalThis.fetch;
  const envNames = ['KAKAO_REST_API_KEY', 'KAKAO_MOBILITY_API_KEY', 'ODSAY_API_KEY', 'OPENAI_API_KEY'];
  const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  try {
    process.env.KAKAO_REST_API_KEY = 'test-key'; process.env.OPENAI_API_KEY = 'test-ai';
    delete process.env.ODSAY_API_KEY; delete process.env.KAKAO_MOBILITY_API_KEY;
    const status = await (await places.GET()).json();
    assert.deepEqual(status, {search: true, car: false, transit: true});
    globalThis.fetch = async input => {
      const url = new URL(input);
      assert.equal(url.hostname, 'dapi.kakao.com');
      if (url.pathname.includes('/search/')) {
        if (url.searchParams.get('size') === '1') return Response.json({documents: [origin]});
        return Response.json({documents: [{...destination, id: 'unknown', x: '129.2', road_address_name: 'Unknown', place_url: 'https://place.map.kakao.com/1'}, {...destination, id: 'fast', road_address_name: 'Known', place_url: 'https://place.map.kakao.com/2'}]});
      }
      return Response.json(url.searchParams.get('end_x') === '129.2' ? {status: 'NO_RESULTS'} : {status: 'OK', routes: [route(1801)]});
    };
    const response = await places.POST(new Request('https://example.test/api/places', {method: 'POST', body: JSON.stringify({type: 'cafe', region: '부산', participants: [{name: '나', origin: '서울역', mode: 'transit'}]})}));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.results.map(p => p.id), ['fast', 'unknown']);
    assert.equal(data.results[0].verified, true); assert.equal(data.results[0].journeys[0].minutes, 31);
    assert.equal(data.results[1].verified, false); assert.equal(data.results[1].journeys[0].minutes, null);
    assert.equal(data.results[1].reason, ''); assert.match(data.results[1].journeys[0].url, /^https:\/\/map.kakao.com\//);
    assert.deepEqual(globalThis.__placeAIInput.places.map(p => p.id), ['fast']);
  } finally {
    globalThis.fetch = oldFetch; delete globalThis.__placeAIInput;
    for (const name of envNames) {if (originalEnv[name] === undefined) delete process.env[name]; else process.env[name] = originalEnv[name];}
  }
});
