import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("migration enforces private events and exposes confirmed availability only", async () => {
  const db = new PGlite();
  const a = "00000000-0000-0000-0000-000000000001",
    b = "00000000-0000-0000-0000-000000000002",
    c = "00000000-0000-0000-0000-000000000003";
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table profiles(id uuid primary key,username text,email text);
 create table groups(id bigint generated always as identity primary key,name text,created_by uuid);
 create table group_members(group_id bigint references groups(id),user_id uuid references auth.users(id),primary key(group_id,user_id));
 create table schedules(user_id uuid,date date,status text,event_title text);
 create table work_patterns(user_id uuid,shift_name text,shift_code text,start_time time,end_time time);
 insert into auth.users values('${a}'),('${b}'),('${c}');
 insert into profiles values('${a}','Alice',null),('${b}','Bob',null),('${c}','Outside',null);
 insert into work_patterns values('${a}','야간','N','22:00','07:00');
 insert into schedules values('${b}','2026-09-29','A','private legacy');
 grant select,insert,update,delete on all tables in schema public to authenticated;
 grant usage,select on all sequences in schema public to authenticated;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609290001_planner.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';`);
  const group = (await db.query(`select planner_create_group('Test') as id`))
    .rows[0].id;
  await db.exec(`insert into group_members values(${group},'${b}');`);
  const imported = (await db.query("select * from planner_patterns")).rows;
  assert.equal(imported[0].end_day_offset, 1);
  await db.exec(
    `set request.jwt.claim.sub='${b}';insert into planner_events(user_id,title,starts_at,ends_at,kind) values('${b}','PRIVATE NIGHT','2026-09-28T22:00:00+09:00','2026-09-29T07:00:00+09:00','work');insert into planner_coverage values('${b}','2026-09-29');`,
  );
  const existing = (
    await db.query(`select id from planner_events where user_id='${b}'`)
  ).rows[0].id;
  await db.exec(
    `update planner_events set google_id='g123',google_etag='e123',sync_state='synced' where id='${existing}'`,
  );
  const changed = {
    id: existing,
    title: "Changed shift",
    starts_at: "2026-09-28T21:00:00+09:00",
    ends_at: "2026-09-29T07:00:00+09:00",
    kind: "work",
    source: "manual",
  };
  await db.query("select planner_save_events($1::jsonb)", [
    JSON.stringify([changed]),
  ]);
  const linked = (
    await db.query(
      `select google_id,google_etag,sync_state,title from planner_events where id='${existing}'`,
    )
  ).rows[0];
  assert.deepEqual(linked, {
    google_id: "g123",
    google_etag: "e123",
    sync_state: "pending",
    title: "Changed shift",
  });
  await assert.rejects(
    db.exec(`insert into group_members values(${group},'${c}')`),
    /row-level security/,
  );
  await db.exec(`set request.jwt.claim.sub='${a}';`);
  await assert.rejects(
    db.query("select planner_save_events($1::jsonb)", [
      JSON.stringify([changed]),
    ]),
    /일부|policy/,
  );
  assert.equal((await db.query("select * from planner_events")).rows.length, 0);
  assert.equal((await db.query("select * from schedules")).rows.length, 0);
  await assert.rejects(
    db.query("select * from google_connections"),
    /permission denied/,
  );
  const slots = (
    await db.query(`select * from group_availability(${group},'2026-09-29')`)
  ).rows;
  assert.equal(slots.length, 96);
  assert.equal(
    slots.some((r) => "title" in r),
    false,
  );
  assert.equal(
    slots.filter((r) => r.user_id === a).some((r) => r.available),
    false,
  );
  assert.equal(slots.filter((r) => r.user_id === b && r.available).length, 34);
  await db.exec(`set request.jwt.claim.sub='${c}';`);
  assert.equal(
    (await db.query(`select * from group_members where group_id=${group}`)).rows
      .length,
    0,
  );
  await assert.rejects(
    db.query(`select * from group_availability(${group},'2026-09-29')`),
    /접근 권한/,
  );
  await db.close();
});
