// Run with Node + Playwright installed. Uses extension API mocks; never contacts Google/TDTU.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const artifactDir = process.env.UI_ARTIFACT_DIR || '/tmp/tdtu-design-audit';
fs.mkdirSync(artifactDir, { recursive: true });
const base = { name: 'Phương pháp lập trình', code: '501042', room: 'F307', group: 'Nhóm 5', dayOfWeek: 1, periodStart: 1, periodEnd: 3, exactDate: new Date(2026, 10, 9).getTime() };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/lib/chromium/chromium', headless: true });
  let checks = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://ui.test/**', route => {
      const name = new URL(route.request().url()).pathname.slice(1);
      const file = path.join(root, name);
      route.fulfill({ body: fs.readFileSync(file), contentType: name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'application/javascript' : 'text/html' });
    });
    await page.addInitScript(() => {
      const listeners = [];
      window.fixture = [];
      window.mode = 'normal';
      window.failSave = false;
      window.chrome = {
        storage: {
          local: {
            get: async key => ({ [key]: JSON.parse(localStorage.getItem(key) || 'null') }),
            set: async object => {
              if (window.failSave) throw Error('Storage failed');
              for (const key in object) {
                localStorage.setItem(key, JSON.stringify(object[key]));
                listeners.forEach(fn => fn({ [key]: { newValue: object[key] } }, 'local'));
              }
            },
            remove: async key => localStorage.removeItem(key)
          },
          onChanged: { addListener: fn => listeners.push(fn) }
        },
        tabs: { query: async () => [{ id: 1, url: 'https://lichhoc-lichthi.tdtu.edu.vn/' }], create: () => {} },
        runtime: { openOptionsPage: () => {}, sendMessage: async () => { if (window.failMessage) throw Error('No worker'); return {started:true}; } },
        action: { setBadgeText: () => {} },
        identity: { getRedirectURL: () => 'https://demo.chromiumapp.org/' },
        scripting: { executeScript: async () => {
          if (window.mode === 'slow') await new Promise(resolve => setTimeout(resolve, 500));
          if (window.mode === 'error') throw Error('Test failure');
          if (window.mode === 'general') return [{result:{view:'general'}}];
          return [{ result: window.fixture }];
        } }
      };
    });
    async function open(language) {
      await page.goto('http://ui.test/popup.html');
      await page.evaluate(language => localStorage.setItem('settings', JSON.stringify({ language })), language);
      await page.reload();
      await page.waitForFunction(language => document.documentElement.lang === language && !!document.body.dataset.stage, language);
    }
    async function fetch(rows) {
      await page.evaluate(rows => { window.fixture = rows; window.mode = 'normal'; }, rows);
      await page.locator('#fetchBtn').click();
      await page.waitForFunction(() => !document.querySelector('#fetchBtn').disabled);
    }
    async function noOverflow() {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal page overflow');
      const overflowing = await page.evaluate(() => [...document.querySelectorAll('.workflow h2,.class-name,.badge,.status-banner,.destination-description')].filter(el => el.getBoundingClientRect().width && el.scrollWidth > el.clientWidth + 2).map(el => el.className));
      assert.deepEqual(overflowing, [], 'clipped text');
    }
    for (const language of ['en', 'vi']) {
      await open(language);
      await noOverflow();
      await fetch([base]);
      assert(await page.locator('#exportICS').isEnabled());
      await page.evaluate(() => { window.mode = 'slow'; });
      await page.locator('#fetchBtn').click();
      assert(await page.locator('#syncGoogle').isDisabled());
      assert(await page.locator('#exportICS').isDisabled());
      assert(await page.locator('#downloadBtn').isDisabled());
      assert(await page.locator('.week-day').first().isDisabled());
      assert(await page.locator('#allDaysBtn').isDisabled());
      await page.waitForFunction(() => !document.querySelector('#fetchBtn').disabled);
      checks++;
      await fetch([]);
      assert.equal(await page.locator('.class-card').count(), 0);
      assert(!(await page.locator('#exportBtns').isVisible()));
      assert(await page.locator('#statusBanner').evaluate(el => el.classList.contains('error')));
      checks++;
      await fetch([base]);
      await page.evaluate(() => { window.mode = 'error'; });
      await page.locator('#fetchBtn').click();
      await page.waitForFunction(() => !document.querySelector('#fetchBtn').disabled);
      assert(!(await page.locator('#exportBtns').isVisible()));
      assert.equal(await page.locator('.class-card').count(), 0);
      checks++;
      await page.evaluate(() => { window.mode = 'general'; });
      await page.locator('#fetchBtn').click();
      await page.waitForFunction(() => !document.querySelector('#fetchBtn').disabled);
      assert.match(await page.locator('#workflowHint').innerText(), /See the weekly schedule/);
      assert(!(await page.locator('#exportBtns').isVisible()));
      checks++;
      await fetch([base, { ...base, code: '502044', name: 'Tổ chức máy tính', periodEnd: 4 }]);
      assert(await page.locator('#scheduleContainer').evaluate(el => el.open));
      assert(await page.locator('#overlapWarn').isVisible());
      assert.equal(await page.locator('.week-day').first().locator('.week-day-dot').count(),2);
      const positions = await page.locator('.week-day').first().locator('.week-day-dot').evaluateAll(els => els.map(el=>el.getBoundingClientRect().y));
      assert.equal(positions[0], positions[1]);
      assert(await page.locator('#classList').evaluate(el=>getComputedStyle(el).maxHeight.replace('px','')>=230));
      assert((await page.locator('#overlapWarn').innerText()).length < 180);
      assert(!(await page.locator('#overlapWarn').innerText()).includes(base.name));
      checks++;
      await page.screenshot({ path: path.join(artifactDir, `overlap-${language}.png`), fullPage: true });
      checks++;
      await fetch([base, { ...base, periodStart:7,periodEnd:9 }, { ...base, code:'502044',dayOfWeek:2,exactDate:new Date(2026,10,10).getTime() }]);
      const weekEvents = await page.evaluate(() => JSON.stringify(buildGoogleEvents(visibleData())));
      await page.locator('.week-day').first().click();
      assert.equal(await page.locator('.class-card').count(),2);
      assert.equal(await page.locator('#countBadge').innerText(),'2');
      await page.screenshot({path:path.join(artifactDir,`day-preview-${language}.png`),fullPage:true});
      assert.equal(await page.locator('.week-day').first().getAttribute('aria-pressed'),'true');
      assert(await page.locator('.week-day').first().evaluate(el=>el===document.activeElement));
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.class-card').count(),1);
      assert.equal(await page.locator('.week-day').nth(1).getAttribute('aria-pressed'),'true');
      assert(!(await page.locator('#overlapWarn').isVisible()));
      await page.locator('.week-day').last().click();
      assert.equal(await page.locator('.class-card').count(),0);
      assert.equal(await page.locator('#countBadge').innerText(),'0');
      assert((await page.locator('#classList').innerText()).length>0);
      assert(await page.locator('#exportICS').isEnabled());
      assert(await page.locator('#dayViewHint').isVisible());
      assert.equal(await page.evaluate(() => JSON.stringify(buildGoogleEvents(visibleData()))),weekEvents);
      await noOverflow();
      await page.screenshot({path:path.join(artifactDir,`selected-day-${language}.png`),fullPage:true});
      await page.locator('#downloadBtn').click();
      assert(await page.locator('#exportDialog').evaluate(el=>el.open));
      assert.equal(await page.evaluate(()=>document.activeElement.id),'exportICS');
      await page.locator('.format-cancel').focus();
      await page.keyboard.press('Tab');
      await page.waitForFunction(()=>document.activeElement.id==='exportICS');
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('#exportDialog').open && document.activeElement.id==='downloadBtn');
      checks++;
      await page.locator('#downloadBtn').click();
      await page.locator('.format-cancel').click();
      await page.waitForFunction(()=>!document.querySelector('#exportDialog').open);
      await page.locator('#downloadBtn').click();
      await page.mouse.click(2,2);
      await page.waitForFunction(()=>!document.querySelector('#exportDialog').open);
      checks++;
      for (const [id,extension] of [['exportICS','.ics'],['exportExcel','.csv']]) {
        await page.locator('#downloadBtn').click();
        await noOverflow();
        await page.screenshot({path:path.join(artifactDir,`format-chooser-${language}.png`),fullPage:true});
        const pending = page.waitForEvent('download',{timeout:10000});
        await page.locator('#'+id).click();
        const download = await pending;
        assert(download.suggestedFilename().endsWith(extension));
        const body = fs.readFileSync(await download.path(),'utf8');
        if(extension==='.ics') assert.equal((body.match(/BEGIN:VEVENT/g)||[]).length,3);
        else assert.equal(body.trim().split('\n').length,4);
        assert(!(await page.locator('#exportDialog').evaluate(el=>el.open)));
        checks++;
      }
      await page.locator('#allDaysBtn').click();
      assert.equal(await page.locator('.class-card').count(),3);
      assert.equal(await page.locator('#allDaysBtn').getAttribute('aria-pressed'),'true');
      assert(!(await page.locator('#dayViewHint').isVisible()));
      await page.locator('.week-day').first().click();
      await fetch([base]);
      assert.equal(await page.locator('#allDaysBtn').getAttribute('aria-pressed'),'true');
      checks+=5;
      const long = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(8);
      await fetch([{ ...base, name: long, group: long.slice(0, 60), room: long.slice(0, 100), note: long.slice(0, 100) }]);
      await page.locator('#scheduleLabel').click();
      await noOverflow();
      await page.evaluate(() => setStatus('error', 'AnUnbrokenErrorMessage'.repeat(20)));
      await noOverflow();
      await page.screenshot({ path: path.join(artifactDir, `long-${language}.png`), fullPage: true });
      checks++;
      await page.evaluate(async () => {
        SETTINGS.blacklist = [{ match: '501042', name: '' }];
        await chrome.storage.local.set({ settings: SETTINGS });
      });
      await fetch([base]);
      assert(await page.locator('#exportICS').isDisabled());
      assert(await page.locator('#exportExcel').isDisabled());
      assert(await page.locator('#syncGoogle').isEnabled());
      assert(await page.locator('#scheduleContainer').evaluate(el => el.open));
      checks++;
    }
    await page.evaluate(async () => {
      SETTINGS.clientId = '12345-demo.apps.googleusercontent.com';
      SETTINGS.blacklist = [];
      await chrome.storage.local.set({settings:SETTINGS});
      window.failMessage = true;
    });
    await fetch([base]);
    await page.locator('#syncGoogle').click();
    await page.waitForFunction(() => document.querySelector('#syncStatus').classList.contains('error'));
    assert(await page.locator('#syncGoogle').isEnabled());
    assert(await page.locator('#fetchBtn').isEnabled());
    checks++;
    await page.goto('http://ui.test/options.html');
    await page.waitForFunction(() => !!document.querySelector('#redirect').value);
    assert.equal(await page.locator('.settings-nav [aria-current=location]').getAttribute('href'),'#appearance');
    for (const section of ['calendar','colors','classes','appearance']) {
      await page.locator('.settings-nav a[href="#'+section+'"]').click();
      await page.waitForFunction(id=>document.querySelector('.settings-nav [aria-current=location]')?.getAttribute('href')==='#'+id,section);
      assert.equal(await page.locator('.settings-nav [aria-current=location]').count(),1);
    }
    await page.locator('#classes').evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-30));
    await page.waitForFunction(()=>document.querySelector('.settings-nav [aria-current=location]')?.getAttribute('href')==='#classes');
    checks+=2;
    // Editing a subject must refresh its filter action without replacing the focused input.
    const editableCode = page.locator('#subjects .code').first();
    const savedCode = await editableCode.inputValue();
    await page.locator('#filterType').selectOption('code');
    await page.locator('#filterMatch').fill('UI-TEST');
    await page.locator('#filterMatch').press('Enter');
    await editableCode.fill('UI-TEST');
    assert(await page.locator('#subjects .row').first().evaluate(el=>el.classList.contains('subject-hidden')));
    assert(await editableCode.evaluate(el=>el===document.activeElement));
    assert.match(await page.locator('#subjects .subject-action').first().innerText(), /Restore|Khôi phục/);
    await editableCode.fill(savedCode);
    assert(!(await page.locator('#subjects .row').first().evaluate(el=>el.classList.contains('subject-hidden'))));
    await page.locator('#blacklist .subject-action').click();
    checks++;
    // A hide/restore cycle must preserve color settings and persist across reloads.
    const subject = page.locator('#subjects .row').first();
    const originalCode = await subject.locator('input.code').inputValue();
    const originalCount = await page.locator('#subjects .row').count();
    await subject.locator('.subject-action').click();
    await page.waitForFunction(code=>JSON.parse(localStorage.getItem('settings')).blacklist.some(b=>b.match===code && b.type==='code'),originalCode);
    assert.equal(await page.locator('#subjects .row').count(),originalCount);
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#subjects .row.subject-hidden'));
    assert(await page.locator('#subjects .row').first().locator('.subject-action svg').count());
    assert.equal(await page.locator('#subjects .row').count(),originalCount);
    await page.locator('#subjects .row').first().locator('.subject-action').click();
    await page.waitForFunction(code=>!JSON.parse(localStorage.getItem('settings')).blacklist.some(b=>b.match===code),originalCode);
    checks++;
    await page.locator('#addBlack').click();
    assert(await page.locator('#filterError').isVisible());
    await page.locator('#filterType').selectOption('name');
    await page.locator('#filterMatch').fill('lập trình');
    await page.locator('#filterMatch').press('Enter');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('settings')).blacklist.some(b=>b.type==='name' && b.match==='lập trình'));
    assert.equal(await page.locator('#filterMatch').inputValue(),'');
    await page.locator('#filterMatch').fill('LẬP TRÌNH');
    await page.locator('#filterMatch').press('Enter');
    assert(await page.locator('#filterError').isVisible());
    assert.equal(await page.locator('.hidden-rule').count(),1);
    await page.locator('#blacklist .subject-action').click();
    assert(await page.locator('.filter-empty').isVisible());
    assert(await page.locator('#filterMatch').evaluate(el=>el===document.activeElement));
    checks++;
    // Explicit code rules must not match names; name rules must affect actual exports.
    await page.locator('#filterType').selectOption('code');
    await page.locator('#filterMatch').fill('lập trình');
    await page.locator('#filterMatch').press('Enter');
    await page.waitForTimeout(450);
    assert.equal(await page.evaluate(async()=>{await loadSettings(); return isBlacklisted({code:'501042',name:'Phương pháp lập trình'});}),false);
    await page.locator('#blacklist .subject-action').click();
    await page.locator('#filterType').selectOption('name');
    await page.locator('#filterMatch').fill('lập trình');
    await page.locator('#filterMatch').press('Enter');
    await page.waitForTimeout(450);
    assert.equal(await page.evaluate(async()=>{await loadSettings(); return isBlacklisted({code:'501042',name:'Phương pháp lập trình'});}),true);
    await page.locator('#blacklist .subject-action').click();
    await page.locator('#filterMatch').fill('');
    checks++;
    const firstColor = page.locator('#subjects .palette button').first();
    await firstColor.focus();
    await page.keyboard.press('Enter');
    assert(await page.locator('#subjects .palette button').first().evaluate(el => document.activeElement === el));
    checks++;
    const inputs = page.locator('#subjects input.code');
    await inputs.nth(1).fill(await inputs.first().inputValue());
    assert(await page.locator('#duplicateCodes').isVisible());
    assert.equal(await inputs.first().getAttribute('aria-invalid'), 'true');
    checks++;
    await page.locator('#clientId').fill('invalid');
    assert.equal(await page.locator('#clientId').getAttribute('aria-invalid'), 'true');
    assert(await page.locator('#clientIdHint').isVisible());
    await page.locator('#clientId').fill('12345-demo.apps.googleusercontent.com');
    assert.equal(await page.locator('#clientId').getAttribute('aria-invalid'), 'false');
    checks++;
    await page.evaluate(() => { window.failSave = true; });
    await page.locator('#calendarId').fill('demo');
    await page.waitForFunction(() => document.querySelector('#saved').classList.contains('error'));
    assert(await page.locator('#saved').isVisible());
    await page.evaluate(() => { window.failSave = false; });
    checks++;
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } }));
    await page.locator('#copyRedirect').click();
    assert(await page.locator('#saved').evaluate(el => el.classList.contains('error')));
    checks++;
    for (const language of ['en','vi']) {
      await page.locator('#language').selectOption(language);
      for (const width of [320, 390, 651, 800, 1100]) {
        await page.setViewportSize({ width, height: 850 });
        await noOverflow();
        await page.locator('.settings-nav a[href="#appearance"]').evaluate(el=>el.click());
        await page.waitForFunction(()=>document.querySelector('.settings-nav [aria-current=location]')?.getAttribute('href')==='#appearance');
        assert.equal(await page.locator('.settings-nav a').count(),4);
        await page.screenshot({ path: path.join(artifactDir, `settings-${language}-${width}.png`), fullPage: true });
        await page.locator('#classes').screenshot({path:path.join(artifactDir,`filters-${language}-${width}.png`)});
        checks++;
      }
    }
    await page.locator('#animateMascot').check();
    await page.waitForTimeout(400);
    const notes = await page.locator('.ambient-notes').evaluate(container => {
      const note = container.querySelector('span');
      const animation = note.getAnimations()[0];
      animation.pause(); animation.currentTime = 2000;
      const first = getComputedStyle(note).transform;
      animation.currentTime = 7000;
      const second = getComputedStyle(note).transform;
      animation.play();
      return { moving: first !== second, visible: Number(getComputedStyle(note).opacity) > 0, decorative: container.getAttribute('aria-hidden') === 'true', clicks: getComputedStyle(container).pointerEvents };
    });
    assert(notes.moving && notes.visible && notes.decorative);
    assert.equal(notes.clicks, 'none');
    checks++;
    await page.locator('#animateMascot').uncheck();
    assert.equal(await page.locator('.ambient-notes').evaluate(el => getComputedStyle(el).display), 'none');
    await page.locator('#animateMascot').check();
    checks++;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(60);
    assert.equal(await page.locator('.ambient-notes').evaluate(el => getComputedStyle(el).display), 'none');
    assert.equal(await page.locator('.mascot-eyes').evaluate(el => getComputedStyle(el).animationName), 'none');
    checks++;
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => showSettingsNotice('Saved'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#saved')).animationName.startsWith('feedback-'));
    const firstFeedback = await page.locator('#saved').getAttribute('data-feedback');
    await page.evaluate(() => showSettingsNotice('Saved again'));
    assert.notEqual(await page.locator('#saved').getAttribute('data-feedback'), firstFeedback);
    checks++;
    await page.locator('#animateMascot').uncheck();
    await page.evaluate(() => showSettingsNotice('Motion off'));
    assert.equal(await page.locator('#saved').evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await page.locator('#saved').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    checks++;
    await page.locator('#animateMascot').check();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => showSettingsNotice('Reduced motion'));
    assert.equal(await page.locator('#saved').evaluate(el => getComputedStyle(el).animationName), 'none');
    checks++;
    assert.deepEqual(errors, []);
    console.log(`PASS: ${checks} state, layout, keyboard and feedback checks; EN/VI, long content, failed refresh, empty/filtered/overlapping classes, settings at 320/390/651/800/1100px. Artifacts: ${artifactDir}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
