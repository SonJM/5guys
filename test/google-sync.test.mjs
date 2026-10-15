import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const moduleURL=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const compile=async path=>ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const planner=moduleURL(await compile('../src/lib/planner.ts'))
const server=moduleURL('export function adminDb(){return globalThis.__googleTestDb}')
const connection=moduleURL(await compile('../src/lib/google-connection.ts'))
const {requiresGoogleConfiguration,requiresGoogleReconnect}=await import(connection)
const google=await import(moduleURL((await compile('../src/lib/google.ts')).replace('"@/lib/server"',JSON.stringify(server)).replace('"@/lib/planner"',JSON.stringify(planner)).replace('"@/lib/google-connection"',JSON.stringify(connection))))
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64')
process.env.GOOGLE_CLIENT_ID='test-client';process.env.GOOGLE_CLIENT_SECRET='test-secret';process.env.NEXT_PUBLIC_SITE_URL='https://example.test'
function setup(initial=[], incremental=false){
 const tables={google_connections:[{user_id:'u',calendar_id:'primary',refresh_token:google.seal('refresh'),...(incremental?{sync_token:null,sync_requested_at:null}:{})}],planner_events:structuredClone(initial)}
 const remote=new Map();const calls=[];const delta=[];let failAck=false;let expireToken=false;let sequence=0
 const db={from(table){let operation='select',payload,filters=[],start=0,end=Infinity,single=false;const q={
  select(){return q},update(p){operation='update';payload=p;return q},insert(p){operation='insert';payload=p;return q},eq(k,v){filters.push(row=>row[k]===v);return q},lte(k,v){filters.push(row=>row[k]!==undefined&&row[k]!==null&&row[k]<=v);return q},in(k,values){filters.push(row=>values.includes(row[k]));return q},or(){return q},order(){return q},range(a,b){start=a;end=b;return q},maybeSingle(){single=true;return q},
  then(resolve,reject){return Promise.resolve().then(()=>{if(failAck&&table==='planner_events'&&operation==='update'&&payload.google_id){failAck=false;return {error:{message:'simulated failed acknowledgement'}}}let rows=tables[table].filter(r=>filters.every(f=>f(r)));if(operation==='update')rows.forEach(r=>Object.assign(r,payload));if(operation==='insert'){const row={id:`import-${++sequence}`,...payload};tables[table].push(row);rows=[row]}const data=structuredClone(rows.slice(start,end+1));return {data:single?data[0]??null:data,error:null}}).then(resolve,reject)}
 };return q}}
 globalThis.__googleTestDb=db
 const originalFetch=globalThis.fetch
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(input);const method=init.method??'GET';calls.push({url:url.toString(),method,body:init.body})
  if(url.hostname==='oauth2.googleapis.com')return Response.json({access_token:'access'})
  const id=decodeURIComponent(url.pathname.split('/events/')[1]??'');const current=remote.get(id)
  if(method==='GET'){
   if(!id&&url.searchParams.has('syncToken')&&expireToken){expireToken=false;return new Response(null,{status:410})}
   return id?(current?Response.json(current):new Response(null,{status:404})):Response.json({items:url.searchParams.has('syncToken')?delta:[...remote.values()],...(incremental?{nextSyncToken:url.searchParams.has('syncToken')?'t2':'t1'}:{})})
  }
  if(method==='POST'){const body=JSON.parse(init.body);if(remote.has(body.id))return new Response(null,{status:409});const event={...body,etag:`e${++sequence}`};remote.set(body.id,event);return Response.json(event)}
  if(!current)return new Response(null,{status:404})
  if(init.headers?.['If-Match']&&init.headers['If-Match']!==current.etag)return new Response(null,{status:412})
  if(method==='DELETE'){remote.delete(id);return new Response(null,{status:204})}
  const event={...current,...JSON.parse(init.body),etag:`e${++sequence}`};remote.set(id,event);return Response.json(event)
 }
 return {tables,remote,delta,calls,failAck(){failAck=true},expireToken(){expireToken=true},restore(){globalThis.fetch=originalFetch;delete globalThis.__googleTestDb}}
}
function local(overrides={}){return {id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',user_id:'u',title:'Night shift',starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),kind:'work',source:'manual',sync_state:'pending',updated_at:'2026-09-01T00:00:00Z',google_id:null,...overrides}}
test('Google tokens are encrypted and tampering is rejected',()=>{const sealed=google.seal('secret refresh token');assert.equal(google.unseal(sealed),'secret refresh token');const bytes=Buffer.from(sealed,'base64');bytes[30]^=1;assert.throws(()=>google.unseal(bytes.toString('base64')))})
test('new local event exports once; remote edit and delete return to the service',async()=>{
 const env=setup([local()]);try{
  await google.syncGoogle('u');assert.equal(env.remote.size,1);const row=env.tables.planner_events[0];assert.equal(row.sync_state,'synced')
  env.remote.set(row.google_id,{...env.remote.get(row.google_id),summary:'Edited in Google',etag:'changed'})
  await google.syncGoogle('u');assert.equal(row.title,'Edited in Google');assert.equal(env.tables.planner_events.length,1)
  env.remote.delete(row.google_id);const deleted=await google.syncGoogle('u');assert.ok(row.deleted_at);assert.equal(deleted.deleted,1);assert.equal(deleted.changed,true)
 }finally{env.restore()}
})
test('both-side edits create a conflict without overwriting either side',async()=>{
 const env=setup([local({google_id:'remote',google_etag:'old'})]);try{
  env.remote.set('remote',{id:'remote',summary:'Remote version',etag:'new',start:{dateTime:new Date().toISOString()},end:{dateTime:new Date(Date.now()+3600000).toISOString()}})
  const result=await google.syncGoogle('u');assert.equal(result.conflicts,1);assert.equal(env.tables.planner_events[0].title,'Night shift');assert.equal(env.remote.get('remote').summary,'Remote version');assert.equal(env.calls.some(c=>c.method==='PATCH'),false)
 }finally{env.restore()}
})
test('interrupted insert acknowledgement retries without importing a duplicate',async()=>{
 const env=setup([local()]);try{env.failAck();await assert.rejects(google.syncGoogle('u'));assert.equal(env.remote.size,1);await google.syncGoogle('u');assert.equal(env.tables.planner_events.length,1);assert.equal(env.remote.size,1);assert.equal(env.tables.planner_events[0].sync_state,'synced')}finally{env.restore()}
})
test('local deletion is propagated using the saved Google etag',async()=>{
 const env=setup([local({google_id:'remote',google_etag:'etag',deleted_at:new Date().toISOString()})]);try{env.remote.set('remote',{id:'remote',etag:'etag',start:{dateTime:new Date().toISOString()},end:{dateTime:new Date(Date.now()+3600000).toISOString()}});await google.syncGoogle('u');assert.equal(env.remote.size,0);assert.equal(env.tables.planner_events[0].sync_state,'synced')}finally{env.restore()}
})
test('incremental sync reads only changed events and stores checkpoint after applying them',async()=>{
 const env=setup([],true);try{
  const start=new Date().toISOString();const end=new Date(Date.now()+3600000).toISOString();
  env.remote.set('remote',{id:'remote',summary:'Original',etag:'e1',start:{dateTime:start},end:{dateTime:end}})
  await google.syncGoogle('u');assert.equal(env.tables.google_connections[0].sync_token,'t1')
  env.delta.push({id:'remote',summary:'Changed',etag:'e2',start:{dateTime:start},end:{dateTime:end}})
  await google.syncGoogle('u');
  assert.equal(env.tables.planner_events[0].title,'Changed')
  assert.equal(env.tables.google_connections[0].sync_token,'t2')
  const list=env.calls.filter(c=>c.method==='GET'&&c.url.includes('/events?'))
  assert.equal(new URL(list[1].url).searchParams.get('syncToken'),'t1')
  assert.equal(new URL(list[1].url).searchParams.has('timeMin'),false)
  assert.equal(new URL(list[1].url).searchParams.has('timeMax'),false)
 }finally{env.restore()}
})
test('expired sync token falls back to a complete snapshot',async()=>{
 const env=setup([],true);try{
  await google.syncGoogle('u');env.expireToken();
  await google.syncGoogle('u');
  const list=env.calls.filter(c=>c.method==='GET'&&c.url.includes('/events?'));
  assert.equal(new URL(list[1].url).searchParams.get('syncToken'),'t1');
  assert.equal(new URL(list[2].url).searchParams.has('syncToken'),false);
  assert.equal(env.tables.google_connections[0].sync_token,'t1');
 }finally{env.restore()}
})
test('unchanged incremental sync reports no imported or exported changes',async()=>{
 const env=setup([],true);try{
  const result=await google.syncGoogle('u');assert.equal(result.changed,false);
  const again=await google.syncGoogle('u');assert.equal(again.changed,false);
 }finally{env.restore()}
})
test('token endpoint errors only require reconnect for invalid grants, and retain tokens for retry', async () => {
 for (const [status, code, reconnect, configuration] of [[400,'invalid_grant',true,false],[401,'invalid_client',false,true],[400,'unauthorized_client',false,true],[400,'invalid_request',false,true],[429,'invalid_grant',false,false],[503,'invalid_grant',false,false]]) {
  const env=setup(); const fetchMock=globalThis.fetch; const sealed=env.tables.google_connections[0].refresh_token;
  globalThis.fetch=async(input,init)=>String(input).includes('oauth2.googleapis.com')
   ? Response.json({error:code,error_description:'secret must not be exposed'}, {status}) : fetchMock(input,init);
  try {
   await assert.rejects(google.syncGoogle('u'), error=>{
    assert.equal(requiresGoogleReconnect(error.message),reconnect);
    assert.equal(requiresGoogleConfiguration(error.message),configuration);
    assert.equal(error.message.includes('secret'),false);
    return true;
   });
   assert.equal(env.tables.google_connections[0].refresh_token,sealed);
   assert.equal(env.tables.google_connections[0].locked_until,null);
   assert.equal(requiresGoogleReconnect(env.tables.google_connections[0].last_error),reconnect);
   globalThis.fetch=fetchMock;
   await google.syncGoogle('u');
   assert.equal(env.tables.google_connections[0].last_error,null);
  } finally { env.restore(); }
 }
})
test('non-JSON token failures and network errors do not request reauthorization', async () => {
 for (const failure of [()=>new Response('unavailable',{status:503}),()=>{throw new TypeError('fetch failed')}]) {
  const env=setup(); globalThis.fetch=async()=>failure();
  try {
   await assert.rejects(google.syncGoogle('u'),error=>!requiresGoogleReconnect(error.message));
   assert.equal(env.tables.google_connections[0].locked_until,null);
  } finally { env.restore(); }
 }
})
test('Calendar quota errors do not request reconnect but insufficient scopes do', async () => {
 for (const [status,reason,reconnect] of [[403,'rateLimitExceeded',false],[403,'userRateLimitExceeded',false],[403,'insufficientPermissions',true],[500,'backendError',false]]) {
  const env=setup(); const fetchMock=globalThis.fetch;
  globalThis.fetch=async(input,init)=>String(input).includes('googleapis.com/calendar')
   ? Response.json({error:{errors:[{reason}]}},{status}) : fetchMock(input,init);
  try {
   await assert.rejects(google.syncGoogle('u'),error=>requiresGoogleReconnect(error.message)===reconnect);
   assert.equal(env.tables.google_connections[0].locked_until,null);
  } finally { env.restore(); }
 }
})
test('mentions of permissions or approval in unrelated errors never force reconnect', () => {
 assert.equal(requiresGoogleReconnect('서버 권한 설정을 확인해주세요.'),false);
 assert.equal(requiresGoogleReconnect('관리자 승인이 필요합니다.'),false);
 assert.equal(requiresGoogleReconnect(''),false);
})
