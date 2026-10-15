const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const modulePaths = process.env.PATH.split(path.delimiter).map(item => path.dirname(item));
const esbuild = require(require.resolve('esbuild', { paths: modulePaths }));
const { chromium } = require(require.resolve('playwright', { paths: modulePaths }));

(async () => {
  await esbuild.build({
    entryPoints: ['test/browser/planner-modal.fixture.jsx'], bundle: true, outfile: 'work/planner-modal-fixture.js',
    jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'local-actions', setup(build) {
      build.onResolve({ filter: /^@\/app\/planner-actions$/ }, () => ({ path: 'actions', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
        const act = (name, payload) => { window.__plannerFixture.calls.push({name,payload}); if (window.__plannerFixture.failSave) throw Error('테스트 저장 오류: 입력을 유지해주세요.'); };
        export async function saveEvents(payload) { act('save',payload); }
        export async function deleteEvents(...payload) { act('delete',payload); }
        export async function updateSeries(...payload) { act('series',payload); }
      ` }));
      build.onResolve({ filter: /^@\// }, args => ({ path: path.resolve('src', args.path.slice(2)) + (args.path.endsWith('PlannerModal') || args.path.endsWith('MonthGrid') ? '.tsx' : '.ts') }));
    } }],
  });
  const css = fs.readdirSync('.next/static/css').filter(name => name.endsWith('.css')).map(name => fs.readFileSync(`.next/static/css/${name}`, 'utf8')).join('\n');
  const script = fs.readFileSync('work/planner-modal-fixture.js');
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`;
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/calendar/month')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ month: new URL(req.url, 'http://localhost').searchParams.get('month'), events: [{ id: 'event-one', title: '편집 확인 일정', starts_at: '2026-10-15T09:00:00+09:00', ends_at: '2026-10-15T10:00:00+09:00', kind: 'appointment', source: 'manual', series_id: 'series-one', all_day: false }], patterns: [], legacy: [] }));
    } else if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(script); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568}]) {
      const page = await browser.newPage({ viewport, timezoneId: 'Asia/Seoul', hasTouch: viewport.width < 640, isMobile: viewport.width < 640 });
      page.setDefaultTimeout(15000);
      console.log(`Testing ${viewport.width}x${viewport.height}`);
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); console.log('BROWSER ERROR', error.message); });
      await page.clock.setFixedTime(new Date('2026-10-15T03:00:00Z'));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const add = page.getByRole('button', {name: viewport.width < 640 ? '+ 일정' : '+ 새 일정', exact: true});
      await add.scrollIntoViewIfNeeded();
      const originalScroll = await page.evaluate(()=>window.scrollY);
      await add.click();
      const dialog = page.getByRole('dialog', {name:'일정 추가',exact:true});
      await dialog.waitFor();
      const box = await dialog.boundingBox();
      if (viewport.width >= 640) {
        assert.ok(Math.abs(box.x + box.width/2 - viewport.width/2) < 2, 'desktop horizontal viewport center');
        assert.ok(Math.abs(box.y + box.height/2 - viewport.height/2) < 2, 'desktop vertical viewport center');
      } else {
        assert.ok(Math.abs(box.width - viewport.width) < 2, 'mobile full width');
        assert.ok(Math.abs(box.height - viewport.height) < 2, 'mobile visible viewport height');
      }
      assert.equal(await page.locator('nav').evaluate(node=>getComputedStyle(node).visibility), 'hidden');
      await page.getByRole('textbox',{name:'일정 제목'}).fill('일정 UI 초안');
      await page.getByLabel('반복 주기').selectOption('weekly');
      const save = page.getByRole('button',{name:'일정 추가하기',exact:true});
      const saveBox = await save.boundingBox();
      assert.ok(saveBox.y >= 0 && saveBox.y + saveBox.height <= viewport.height + 1, 'save remains in viewport with expanded repeat');
      if (viewport.width < 640) {
        await page.setViewportSize({width:viewport.width,height:380});
        await page.waitForFunction(()=>Math.abs(document.querySelector('dialog').getBoundingClientRect().height-window.innerHeight)<2);
        const reducedSave = await save.boundingBox();
        assert.ok(reducedSave.y + reducedSave.height <= 381, 'save remains visible with a reduced viewport');
        await page.screenshot({path:`work/editor-keyboard-${viewport.width}.png`});
        await page.setViewportSize(viewport);
        await page.waitForFunction(()=>Math.abs(document.querySelector('dialog').getBoundingClientRect().height-window.innerHeight)<2);
      }
      await page.screenshot({path:`work/editor-${viewport.width}.png`});
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
      assert.ok(Math.abs(await page.evaluate(()=>window.scrollY)-originalScroll)<2, 'background scroll restored');
      await add.click();
      assert.equal(await page.getByRole('textbox',{name:'일정 제목'}).inputValue(),'일정 UI 초안');
      await page.evaluate(()=>history.back());
      await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
      await add.click();
      assert.equal(await page.getByRole('textbox',{name:'일정 제목'}).inputValue(),'일정 UI 초안');
      await page.getByLabel('반복 주기').selectOption('none');
      await save.click();
      await page.getByRole('alert').filter({hasText:'테스트 저장 오류'}).waitFor();
      assert.equal(await page.getByRole('textbox',{name:'일정 제목'}).inputValue(),'일정 UI 초안');
      await page.evaluate(()=>{window.__plannerFixture.failSave=false;});
      await save.click();
      await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
      assert.equal(await page.locator('nav').evaluate(node=>getComputedStyle(node).visibility),'visible');
      await add.click();
      assert.equal(await page.getByRole('textbox',{name:'일정 제목'}).inputValue(),'');
      await page.getByRole('button',{name:'닫기',exact:true}).click();
      await page.getByRole('button',{name:/편집 확인 일정/}).first().click();
      const beforeEdit = await page.evaluate(()=>window.__plannerFixture.calls.length);
      await page.getByRole('button',{name:'일정 수정',exact:true}).click();
      await page.getByRole('dialog',{name:'일정 수정',exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>window.__plannerFixture.calls.length),beforeEdit,'opening editor must not submit it');
      await page.getByRole('textbox',{name:'일정 제목'}).fill('수정 초안');
      await page.getByLabel('수정 범위').selectOption('all');
      assert.equal(await page.getByLabel('일정 날짜').isDisabled(),true);
      await page.getByRole('button',{name:'닫기',exact:true}).click();
      await page.getByRole('button',{name:/편집 확인 일정/}).first().click();
      await page.getByRole('button',{name:'일정 수정',exact:true}).click();
      assert.equal(await page.getByRole('textbox',{name:'일정 제목'}).inputValue(),'수정 초안');
      assert.deepEqual(errors, []);
      console.log(`${viewport.width}x${viewport.height}: centered/fullscreen layout, visible save, Escape/back drafts, error recovery, save reset and edit draft passed.`);
      await page.close();
    }
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{ console.error(error); process.exit(1); });
