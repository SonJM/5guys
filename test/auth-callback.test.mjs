import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const connectionSource = ts.transpileModule(await readFile(new URL('../src/lib/google-connection.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const mocks = {
  '@/lib/google-connection': connectionSource,
  '@/utils/supabase/server': 'export const createClient = () => ({ auth: { exchangeCodeForSession: async () => globalThis.__callback.auth } });',
  'next/server': 'export const NextResponse = { redirect: (url) => new Response(null, { status: 307, headers: { location: String(url) } }) };',
  'next/headers': 'export const cookies = async () => ({ get: () => ({ value: "state-cookie" }), set: (...args) => globalThis.__callback.cookie = args });',
  '@/lib/server': 'export const adminDb = () => globalThis.__callback.db; export const session = async () => ({ user: globalThis.__callback.auth.data.user });',
  '@/lib/google': 'export const seal = (value) => { if (globalThis.__callback.failSeal) throw Error("configuration"); return `sealed:${value}`; }; export const unseal = () => JSON.stringify({ user: "app-user", state: "nonce" }); export const googleConfig = () => ({ clientId: "client", secret: "secret", redirect: "https://example.test/api/google/callback" });',
};
async function load(path, overrides = {}) {
  let source = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [name, mock] of Object.entries({ ...mocks, ...overrides })) source = source.replaceAll(`'${name}'`, JSON.stringify(url(mock))).replaceAll(`"${name}"`, JSON.stringify(url(mock)));
  return import(url(source));
}
const login = await load('../src/app/auth/callback/route.ts');
const calendar = await load('../src/app/api/google/callback/route.ts');
const middleware = await load('../src/middleware.ts', {
  '@supabase/ssr': 'export const createServerClient = (url, key, { cookies }) => ({ auth: { getUser: async () => { cookies.setAll([{ name: "sb-test", value: "refreshed", options: { path: "/", httpOnly: true } }]); return { data: { user: globalThis.__callback.middlewareUser } }; } } });',
  'next/server': 'function response(destination) { const values = new Map(); return { destination, cookies: { set(name, value, options) { const cookie = typeof name === "object" ? name : { name, value, ...options }; values.set(cookie.name, cookie); }, getAll() { return [...values.values()]; } } }; } export const NextResponse = { next: () => response(null), redirect: (url) => response(String(url)) };',
});
function setup({ existing = null, token = 'new-refresh', failSeal = false, lookupError = null } = {}) {
  const state = {
    failSeal,
    auth: { error: null, data: { user: { id: 'app-user', identities: [{ provider: 'google', id: 'google-account', identity_data: { sub: 'google-account' } }] }, session: { provider_refresh_token: token } } },
    db: { from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: existing, error: lookupError }; }, async upsert(payload) { state.saved = payload; return { error: null }; } }; } },
  };
  globalThis.__callback = state;
  return state;
}
test('first login stores Calendar token and reaches requested app page', async () => {
  const state = setup();
  const response = await login.GET(new Request('https://example.test/auth/callback?code=code&next=/dashboard?view=findDate'));
  assert.equal(response.headers.get('location'), 'https://example.test/dashboard?view=findDate');
  assert.equal(state.saved.refresh_token, 'sealed:new-refresh');
});
test('Calendar configuration failure preserves completed app login', async () => {
  setup({ failSeal: true });
  const response = await login.GET(new Request('https://example.test/auth/callback?code=code'));
  const destination = new URL(response.headers.get('location'));
  assert.equal(destination.pathname, '/dashboard');
  assert.ok(destination.searchParams.get('calendarError'));
});
test('missing Calendar token never sends a successfully signed-in user back to login', async () => {
  setup({ token: null });
  const response = await login.GET(new Request('https://example.test/auth/callback?code=code&next=//other.test'));
  assert.equal(new URL(response.headers.get('location')).pathname, '/dashboard');
});
test('reusing old Calendar token does not clear its known sync error', async () => {
  const state = setup({ token: null, existing: { google_account: 'google-account', refresh_token: 'old-encrypted' } });
  await login.GET(new Request('https://example.test/auth/callback?code=code'));
  assert.equal(state.saved.refresh_token, 'old-encrypted');
  assert.equal(Object.hasOwn(state.saved, 'last_error'), false);
});
test('another device login preserves an established Calendar token even when Google issues a new token', async () => {
  const state = setup({ existing: { google_account: 'google-account', refresh_token: 'working-encrypted', last_error: null } });
  await login.GET(new Request('https://example.test/auth/callback?code=code'));
  assert.equal(state.saved.refresh_token, 'working-encrypted');
  assert.equal(Object.hasOwn(state.saved, 'last_error'), false);
});
test('a fresh login token can replace a connection known to require reauthorization', async () => {
  const state = setup({ existing: { google_account: 'google-account', refresh_token: 'expired-encrypted', last_error: 'Google 인증 정보를 사용할 수 없습니다. 다시 연결해주세요.' } });
  await login.GET(new Request('https://example.test/auth/callback?code=code'));
  assert.equal(state.saved.refresh_token, 'sealed:new-refresh');
  assert.equal(state.saved.last_error, null);
});
test('another device login does not erase a transient sync error or replace its token', async () => {
  const state = setup({ existing: { google_account: 'google-account', refresh_token: 'working-encrypted', last_error: 'temporary failure' } });
  await login.GET(new Request('https://example.test/auth/callback?code=code'));
  assert.equal(state.saved.refresh_token, 'working-encrypted');
  assert.equal(Object.hasOwn(state.saved, 'last_error'), false);
});
test('failed app authentication returns to login', async () => {
  const state = setup(); state.auth.error = { message: 'invalid code' };
  const response = await login.GET(new Request('https://example.test/auth/callback?code=bad'));
  assert.equal(new URL(response.headers.get('location')).pathname, '/login');
});
test('Calendar cancellation clears the cookie at its original path and retains app login', async () => {
  const state = setup();
  const response = await calendar.GET({ nextUrl: new URL('https://example.test/api/google/callback?error=access_denied&state=nonce') });
  assert.equal(new URL(response.headers.get('location')).pathname, '/dashboard');
  assert.deepEqual(state.cookie, ['calendar_oauth', '', { path: '/api/google', maxAge: 0 }]);
  assert.equal(state.saved, undefined);
});
test('Calendar recovery rejects another Google account without replacing existing connection', async () => {
  const state = setup(); const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => String(input).includes('/token')
    ? Response.json({ refresh_token: 'token', access_token: 'access', scope: 'https://www.googleapis.com/auth/calendar.events' })
    : Response.json({ sub: 'different-google-account' });
  try {
    const response = await calendar.GET({ nextUrl: new URL('https://example.test/api/google/callback?code=code&state=nonce') });
    const destination = new URL(response.headers.get('location'));
    assert.equal(destination.pathname, '/dashboard');
    assert.match(destination.searchParams.get('calendarError'), /로그인한 Google 계정/);
    assert.equal(state.saved, undefined);
  } finally { globalThis.fetch = originalFetch; }
});
test('middleware retains refreshed session cookies on redirect and forwards them to the request', async () => {
  const state = setup(); state.middlewareUser = { id: 'app-user' };
  const requestCookies = new Map();
  const response = await middleware.middleware({ url: 'https://example.test/login', nextUrl: new URL('https://example.test/login'), headers: {}, cookies: { getAll: () => [], set: (name, value) => requestCookies.set(name, value) } });
  assert.equal(response.destination, 'https://example.test/dashboard');
  assert.deepEqual(response.cookies.getAll(), [{ name: 'sb-test', value: 'refreshed', path: '/', httpOnly: true }]);
  assert.equal(requestCookies.get('sb-test'), 'refreshed');
});
