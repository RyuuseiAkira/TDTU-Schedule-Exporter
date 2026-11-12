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
      await fetch([base, { ...base, code: '502044', name: 'Tổ chức máy tính', periodEnd: 4 }]);
      assert(await page.locator('#scheduleContainer').evaluate(el => el.open));
      assert(await page.locator('#overlapWarn').isVisible());
      await page.screenshot({ path: path.join(artifactDir, `overlap-${language}.png`), fullPage: true });
      checks++;
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
    for (const width of [320, 390, 1100]) {
      await page.setViewportSize({ width, height: 850 });
      await noOverflow();
      await page.screenshot({ path: path.join(artifactDir, `settings-${width}.png`), fullPage: true });
      checks++;
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
    console.log(`PASS: ${checks} state, layout, keyboard and feedback checks; EN/VI, long content, failed refresh, empty/filtered/overlapping classes, settings at 320/390/1100px. Artifacts: ${artifactDir}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
