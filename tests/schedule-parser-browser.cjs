// Optional private fixtures: node tests/schedule-parser-browser.cjs general.html weekly.html
// Uploaded timetable files are read locally and must not be committed.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'popup.js'),'utf8');
const scraper=source.slice(source.indexOf('function scrapeWeeklyCalendar()'),source.indexOf('// ─── Export ICS'));
const general=process.argv[2] ? fs.readFileSync(process.argv[2],'utf8') : '<input id="ThoiKhoaBieu1_radXemTKBTongHop" type="radio" checked><input id="ThoiKhoaBieu1_radXemTKBTheoTuan" type="radio">';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/lib/chromium/chromium',headless:true});
 try{
  const page=await browser.newPage();
  const fixtures=[general,...(process.argv[3]?[fs.readFileSync(process.argv[3],'utf8')]:[])];
  await page.route('**/*',route=>{
   const index=route.request().url()==='http://fixture.test/0'?0:route.request().url()==='http://fixture.test/1'?1:-1;
   if(index<0||!fixtures[index])return route.abort();
   return route.fulfill({body:fixtures[index],contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"}});
  });
  await page.goto('http://fixture.test/0');
  assert.deepEqual(await page.evaluate(code=>(0,eval)('('+code+')()'),scraper),{view:'general'});
  if(fixtures[1]){
   await page.goto('http://fixture.test/1');
   const classes=await page.evaluate(code=>(0,eval)('('+code+')()'),scraper);
   assert(Array.isArray(classes)&&classes.length>0);
   assert(classes.every(c=>Number.isFinite(c.exactDate)));
   console.log(`PASS: private weekly fixture returned ${classes.length} dated sessions`);
  }
  console.log('PASS: general view produces a weekly-view instruction signal, not timetable data');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
