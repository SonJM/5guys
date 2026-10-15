const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const modulePaths = process.env.PATH.split(path.delimiter).map(item => path.dirname(item));
const esbuild = require(require.resolve('esbuild', {paths:modulePaths}));
const { chromium } = require(require.resolve('playwright', {paths:modulePaths}));

(async()=>{
  const mocks = {
    '@/utils/supabase/client': `const db={auth:{getUser:async()=>({data:{user:{id:'fixture-user',email:'fixture@example.test'}}})},from(table){const q={select(){return q},eq(){return q},order(){return q},single(){return q},then(resolve){return Promise.resolve({data:table==='profiles'?{username:'테스트'}:table==='group_members'?[{groups:{id:1,name:'테스트 그룹'}}]:[],count:1}).then(resolve)}};return q}};export const createClient=()=>db;`,
    '@/components/CalendarChangeListener':'export default function(){return null}',
    '@/components/GoogleCalendarConnection':'export default function(){return null}',
    '@/components/UsernameSetupModal':'export default function(){return null}',
    '@/components/SignOutButton':'export default function(){return <button>로그아웃</button>}',
    '@/components/ThemeSwitcher':'export function ThemeSwitcher(){return <button>테마</button>}',
    'next/link':'export default function({href,children,...props}){return <a href={href} {...props}>{children}</a>}',
    '@/app/planner-actions':'export async function saveEvents(){};export async function deleteEvents(){};export async function updateSeries(){};',
  };
  for(const [name,label] of Object.entries({GroupAvailability:'그룹 입력',GroupManager:'멤버 입력',PlaceRecommendations:'장소 입력',OcrUploader:'근무표 입력'})) {
    mocks[`@/components/${name}`]=`import {useState} from 'react';export default function(){const [value,setValue]=useState('');return <label>${label}<input aria-label="${label}" type="text" value={value} onChange={e=>setValue(e.target.value)}/></label>}`;
  }
  await esbuild.build({entryPoints:['test/browser/motion.fixture.jsx'],bundle:true,outfile:'work/motion-fixture.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'fixture',setup(build){
    build.onResolve({filter:/.*/},args=>mocks[args.path]?{path:args.path,namespace:'fixture'}:null);
    build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'jsx',resolveDir:process.cwd()}));
    build.onResolve({filter:/^@\//},args=>{const base=path.resolve('src',args.path.slice(2));return {path:['.tsx','.ts'].map(extension=>base+extension).find(file=>fs.existsSync(file))}});
  }}]});
  const css=fs.readdirSync('.next/static/css').filter(name=>name.endsWith('.css')).map(name=>fs.readFileSync(`.next/static/css/${name}`,'utf8')).join('\n');
  const js=fs.readFileSync('work/motion-fixture.js');
  const server=http.createServer((req,res)=>{
    if(req.url.startsWith('/api/calendar/month')){
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify({month:new URL(req.url,'http://localhost').searchParams.get('month'),events:[],patterns:[],legacy:[]}));
    }else if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(js)}
    else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`)}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});
    for(const width of [390,320]){
      const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,timezoneId:'Asia/Seoul'});
      page.setDefaultTimeout(15000);
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));
      await page.goto(`http://127.0.0.1:${server.address().port}/dashboard`);
      const panel=name=>page.locator(`[data-view="${name}"]`);
      const settle=()=>page.waitForFunction(()=>document.getAnimations().every(animation=>animation.playState!=='running'));
      const initialX=name=>panel(name).evaluate(node=>{
        const transform=node.getAnimations()[0]?.effect.getKeyframes()[0].transform;
        return transform ? new DOMMatrix(transform).m41 : null;
      });
      await panel('schedule').waitFor();await settle();
      await page.getByRole('button',{name:'그룹',exact:true}).click();
      assert.ok(await initialX('findDate')>0,'forward slide starts from the right');
      await page.getByLabel('그룹 입력').fill('보존할 그룹 초안');await settle();
      await page.getByRole('button',{name:'장소 추천',exact:true}).click();await page.getByLabel('장소 입력').fill('서울역');await settle();
      await page.getByRole('button',{name:'그룹',exact:true}).click();
      assert.ok(await initialX('findDate')<0,'return slide starts from the left');
      await settle();assert.equal(await page.getByLabel('그룹 입력').inputValue(),'보존할 그룹 초안');
      // Interrupt animations with actual DOM clicks rather than waiting for stability.
      await page.evaluate(async()=>{
        const nav=document.querySelector('nav[aria-label="모바일 주요 메뉴"]');
        for(const label of ['더보기','내 일정','장소 추천','내 일정']) {
          nav.querySelector(`button[aria-label="${label}"]`).click();
          await new Promise(resolve=>requestAnimationFrame(resolve));
        }
      });
      await settle();
      assert.equal(await page.locator('.slide-panel:not([hidden])').count(),1);
      assert.equal(await panel('schedule').getAttribute('aria-hidden'),'false');
      assert.equal(await panel('findDate').getAttribute('inert'),'');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no horizontal overflow');
      await page.getByRole('button',{name:'다음 달',exact:true}).click();
      const calendar=page.locator('[data-calendar-month]');
      const monthForward=await calendar.evaluate(node=>node.getAnimations()[0]?.effect.getKeyframes());
      assert.ok(monthForward?.[0].transform.includes('56px'),'next month moves in from right');await settle();
      await page.getByRole('button',{name:'이전 달',exact:true}).click();
      const monthBack=await calendar.evaluate(node=>node.getAnimations()[0]?.effect.getKeyframes());
      assert.ok(monthBack?.[0].transform.includes('-56px'),'previous month moves in from left');await settle();
      await page.getByRole('button',{name:'장소 추천',exact:true}).click();await settle();
      assert.equal(await page.getByLabel('장소 입력').inputValue(),'서울역');
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.getByRole('button',{name:'내 일정',exact:true}).click();
      assert.equal(await panel('schedule').evaluate(node=>node.getAnimations().length),0);
      await page.getByRole('button',{name:'다음 달',exact:true}).click();
      assert.equal(await calendar.evaluate(node=>node.getAnimations().length),0);
      assert.deepEqual(errors,[]);
      console.log(`${width}px: directional tabs/months, preserved inputs, rapid navigation, inert hidden screens, no overflow and reduced motion passed.`);
      await page.close();
    }
  }finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})().catch(error=>{console.error(error);process.exit(1)});
