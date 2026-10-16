import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('invite search finds signup-only accounts despite profile RLS and paginates without exposing all users', async () => {
  const db = new PGlite();
  const owner = '00000000-0000-0000-0000-000000000001';
  const member = '00000000-0000-0000-0000-000000000002';
  const signup = '00000000-0000-0000-0000-000000000003';
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      grant usage on schema auth to authenticated;
      create table public.profiles(id uuid primary key, username text, email text);
      create table public.groups(id bigint primary key, created_by uuid);
      create table public.group_members(group_id bigint, user_id uuid);
      alter table public.profiles enable row level security;
      create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
      grant select on public.profiles to authenticated;
      insert into auth.users values
        ('${owner}','owner@example.test'),('${member}','member@example.test'),('${signup}','signup@example.test');
      insert into public.profiles values ('${owner}','Owner','owner@example.test'),('${member}','Member','member@example.test');
      insert into public.groups values(1,'${owner}');
      insert into public.group_members values(1,'${owner}'),(1,'${member}');
      insert into auth.users select ('10000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
        'candidate' || lpad(n::text,2,'0') || '@example.test' from generate_series(1,45) n;
      insert into public.profiles values ('10000000-0000-0000-0000-000000000001','검색할이름','old@example.test');
    `);
    const migration = await readFile(new URL('../supabase/migrations/202610160001_invite_search.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`);
    const search = async (term, offset = 0) => (await db.query(
      'select * from public.planner_search_invitable_users(1,$1,$2)', [term, offset],
    )).rows;
    assert.equal((await db.query('select * from public.profiles')).rows.length, 1);
    assert.deepEqual(await search(' SIGNUP@EXAMPLE '), [{ id: signup, username: null, email: 'signup@example.test' }]);
    assert.equal((await search('검색할')).length, 1);
    assert.equal((await search('candidate01'))[0].email, 'candidate01@example.test');
    assert.deepEqual(await search('owner@'), []);
    assert.deepEqual(await search('member@'), []);
    assert.deepEqual(await search('%_'), []); // Search characters are literal, not SQL wildcards.
    const pages = await Promise.all([search('candidate',0), search('candidate',20), search('candidate',40)]);
    assert.deepEqual(pages.map(page => page.length), [21,21,5]);
    const visible = pages.flatMap(page => page.slice(0,20));
    assert.equal(new Set(visible.map(user => user.id)).size,45);
    assert.deepEqual(await search('candidate',60), []);
    await assert.rejects(search('a'), /2~100/);
    await assert.rejects(search('a'.repeat(101)), /2~100/);
    await assert.rejects(search('candidate',-1), /페이지/);
    await db.exec(`reset role;insert into public.group_members values(1,'${signup}');set role authenticated;`);
    assert.deepEqual(await search('signup'), []);
    await db.exec(`set request.jwt.claim.sub='${member}';`);
    await assert.rejects(search('candidate'), /그룹 생성자/);
    await db.exec(`set request.jwt.claim.sub='${signup}';`);
    await assert.rejects(search('candidate'), /그룹 생성자/);
    await db.exec("set request.jwt.claim.sub='';");
    await assert.rejects(search('candidate'), /그룹 생성자/);
    await db.exec('set role anon;');
    await assert.rejects(search('candidate'), /permission denied/);
  } finally { await db.close(); }
});
