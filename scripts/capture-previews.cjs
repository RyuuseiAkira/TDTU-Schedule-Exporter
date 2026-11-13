// Generate documentation screenshots with sample data, not personal account access.
// Requires Playwright and Chromium. Run: node scripts/capture-previews.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/images');
const fixtures = [
  {name:'Phương pháp lập trình',code:'501042',room:'F307',group:'Nhóm 5',dayOfWeek:1,periodStart:1,periodEnd:3,exactDate:new Date(2026,10,9).getTime()},
  {name:'Tổ chức máy tính',code:'502044',room:'B204',group:'Nhóm 2',dayOfWeek:1,periodStart:7,periodEnd:9,exactDate:new Date(2026,10,9).getTime()},
  {name:'Tổ chức máy tính',code:'502044',room:'B204',group:'Nhóm 2',dayOfWeek:2,periodStart:4,periodEnd:6,exactDate:new Date(2026,10,10).getTime()},
  {name:'Pháp luật đại cương',code:'302053',room:'C305',group:'Nhóm 1',dayOfWeek:4,periodStart:7,periodEnd:9,exactDate:new Date(2026,10,12).getTime()}
];
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/lib/chromium/chromium',headless:true});
  try {
    for (const language of ['en','vi']) {
      const page = await browser.newPage({viewport:{width:320,height:700},deviceScaleFactor:2});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('http://preview.test/**',route=>{
        const file=path.join(root,new URL(route.request().url()).pathname.slice(1));
        const mime=file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':'text/html';
        route.fulfill({body:fs.readFileSync(file),contentType:mime});
      });
      await page.addInitScript(({language,fixtures})=>{
        const settings={language,clientId:'123456789-preview.apps.googleusercontent.com'};
        window.chrome={
          storage:{local:{get:async()=>({settings}),set:async()=>{},remove:async()=>{}},onChanged:{addListener:()=>{}}},
          tabs:{query:async()=>[{id:1,url:'https://lichhoc-lichthi.tdtu.edu.vn/'}],create:()=>{}},
          runtime:{openOptionsPage:()=>{},sendMessage:async()=>({started:true})},
          action:{setBadgeText:()=>{}},identity:{getRedirectURL:()=> 'https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/'},
          scripting:{executeScript:async()=>[{result:fixtures}]}
        };
      },{language,fixtures});
      const freeze = async()=>{
        await page.mouse.move(0,0);
        await page.waitForTimeout(250);
        await page.evaluate(()=>document.getAnimations().forEach(animation=>{
          animation.pause();
          animation.currentTime=animation.effect.target?.closest?.('.ambient-notes')?2500:1000;
        }));
      };
      await page.goto('http://preview.test/popup.html');
      await page.waitForFunction(language=>document.documentElement.lang===language && !!document.body.dataset.stage,language);
      await page.locator('#fetchBtn').click();
      await page.waitForSelector('body.schedule-ready');
      await freeze();
      await page.locator('body').screenshot({path:path.join(output,`popup-${language}.png`)});
      await page.setViewportSize({width:1000,height:820});
      await page.goto('http://preview.test/options.html');
      await page.waitForFunction(()=>!!document.querySelector('#redirect').value);
      if(await page.locator('#clientId').getAttribute('type')!=='password')throw Error('Client ID must be masked');
      await freeze();
      await page.screenshot({path:path.join(output,`settings-${language}.png`),fullPage:true});
      await page.locator('#classes').screenshot({path:path.join(output,`filters-${language}.png`)});
      await page.locator('#calendar').scrollIntoViewIfNeeded();
      await freeze();
      await page.locator('#calendar').screenshot({path:path.join(output,`calendar-setup-${language}.png`)});
      if(errors.length)throw Error(errors.join('\n'));
      console.log(`Captured ${language}: popup, settings, calendar setup`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
