const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function setup() {
  const chrome = {runtime: {onInstalled: {addListener() {}}, onMessage: {addListener() {}}}, storage: {local: {get: async () => ({settings: {clientId:'12345-test.apps.googleusercontent.com'}})}}};
  const ctx = vm.createContext({chrome, Date, TextEncoder});
  for (const name of ['config.js', 'shared.js', 'i18n.js', 'background.js']) vm.runInContext(read(name), ctx);
  return ctx;
}
test('color lookup rejects inherited object properties and safely stores special subject codes', () => {
  const ctx = setup();
  for (const key of ['constructor', '__proto__', 'toString']) assert.equal(vm.runInContext(`lookupColor(${JSON.stringify(key)})`, ctx), null);
  assert.equal(vm.runInContext("lookupColor('11').id", ctx), '11');
  assert.equal(vm.runInContext(`sanitizeSettings(JSON.parse('{"subjectColors":{"__proto__":"tomato"}}')).subjectColors.__proto__`,ctx), 'tomato');
});
test('sync validation rejects rollover dates and accepts leap days', () => {
  const ctx = setup();
  for (const date of ['2026-02-29T06:50:00', '2026-04-31T06:50:00', '2026-11-12T24:00:00']) assert.equal(vm.runInContext(`validDateTime('${date}')`,ctx),false);
  assert.equal(vm.runInContext("validDateTime('2028-02-29T06:50:00')",ctx),true);
  assert.equal(vm.runInContext("validRange({from:'2026-02-30',to:'2026-03-05'})",ctx),null);
});
test('out-of-range events are rejected before requesting OAuth or changing calendars', async () => {
  const ctx = setup();
  await assert.rejects(vm.runInContext(`syncToGoogle([{key:'test',body:{summary:'Class',colorId:'1',start:{dateTime:'2026-11-16T06:50:00'},end:{dateTime:'2026-11-16T09:20:00'}}}],{from:'2026-11-09',to:'2026-11-16'})`,ctx), /Invalid sync date range/);
});
test('date-less Monday belongs to the preceding Monday when today is Sunday', () => {
  const ctx = setup();
  vm.runInContext(`Date = class extends Date { constructor(...args) { super(...(args.length ? args : [2026,10,15,12])); } }`,ctx);
  assert.equal(vm.runInContext("localDateTime(classBaseDate({dayOfWeek:1}), '06:50')",ctx),'2026-11-09T06:50:00');
});
test('ICS uses the same period times as Google exports, with valid UTF-8 line folding', () => {
  const ctx = setup(), source = read('popup.js');
  vm.runInContext(source.slice(source.indexOf('const PERIOD_TIMES ='),source.indexOf('// ─── DOM refs')) + source.slice(source.indexOf('function icsEscape('),source.indexOf('// ─── Đồng bộ Google Calendar')),ctx);
  const output = vm.runInContext(`generateICS([{name:'Lập trình '.repeat(30),code:'501042',periodStart:13,periodEnd:16,exactDate:new Date(2026,10,9).getTime()}])`,ctx);
  assert.match(output,/DTSTART;TZID=Asia\/Ho_Chi_Minh:20261109T180500/);
  assert.match(output,/DTEND;TZID=Asia\/Ho_Chi_Minh:20261109T212500/);
  assert(output.endsWith('\r\n'));
  for (const line of output.split('\r\n')) assert(Buffer.byteLength(line)<=75);
});
test('typed filters distinguish exact codes from name keywords and preserve legacy rules', () => {
  const ctx = setup();
  vm.runInContext(`const cls={code:'TTSH01',name:'Sinh hoạt TTSH01 - Nhóm 5'};`,ctx);
  assert.equal(vm.runInContext(`matchesFilter(cls,{type:'code',match:'ttsh01'})`,ctx),true);
  assert.equal(vm.runInContext(`matchesFilter(cls,{type:'code',match:'sinh hoạt'})`,ctx),false);
  assert.equal(vm.runInContext(`matchesFilter(cls,{type:'name',match:'NHÓM 5'})`,ctx),true);
  assert.equal(vm.runInContext(`matchesFilter(cls,{match:'sinh hoạt'})`,ctx),true);
  assert.equal(vm.runInContext(`matchesFilter(cls,{match:'01'})`,ctx),false);
  const types=vm.runInContext(`sanitizeSettings({blacklist:[{match:'TTSH01',type:'code'},{match:'Nhóm 5',type:'name'},{match:'legacy'},{match:'bad',type:'invalid'}]}).blacklist.map(b=>b.type).join(',')`,ctx);
  assert.equal(types,'code,name,,');
});
