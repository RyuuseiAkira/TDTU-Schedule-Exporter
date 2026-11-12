const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function context() {
  const ctx = vm.createContext({ chrome: {}, TextEncoder, Date });
  for (const file of ['config.js', 'shared.js', 'i18n.js']) vm.runInContext(read(file), ctx);
  return ctx;
}
test('new and legacy settings default to English; only supported languages survive sanitization', () => {
  const ctx = context();
  for (const source of ['undefined', '{}', '{language:"fr"}', '{language:42}']) {
    assert.equal(vm.runInContext(`sanitizeSettings(${source}).language`, ctx), 'en');
  }
  assert.equal(vm.runInContext('sanitizeSettings({language:"vi"}).language', ctx), 'vi');
  assert.equal(vm.runInContext('sanitizeSettings({animateMascot:false}).animateMascot', ctx), false);
  assert.equal(vm.runInContext('sanitizeSettings({}).animateMascot', ctx), true);
});
test('UI messages support both languages, including OAuth setup and sync failures', () => {
  const ctx = context();
  assert.equal(vm.runInContext("tr('Lấy lịch của tuần này')", ctx), 'Get this week’s schedule');
  assert.match(vm.runInContext("tr('Google Client ID chưa nhập hoặc sai định dạng — mở ⚙️ Settings')", ctx), /missing or invalid/);
  assert.equal(vm.runInContext("classCount(1)", ctx), '1 class');
  vm.runInContext("SETTINGS.language='vi'", ctx);
  assert.equal(vm.runInContext("tr('Lấy lịch của tuần này')", ctx), 'Lấy lịch của tuần này');
  assert.equal(vm.runInContext('classCount(2)', ctx), '2 lớp học');
});
test('changing UI language preserves calendar event identities and ICS UIDs', () => {
  const ctx = context();
  const source = read('popup.js');
  const periods = source.slice(source.indexOf('const PERIOD_TIMES ='), source.indexOf('// ─── DOM refs'));
  const ics = source.slice(source.indexOf('function icsEscape('), source.indexOf('// ─── Đồng bộ Google Calendar'));
  const google = source.slice(source.indexOf('function buildGoogleEvents('), source.indexOf('// Trạng thái đồng bộ hiện'));
  vm.runInContext(periods + ics + google, ctx);
  vm.runInContext(`const fixture = [{name:'Phương pháp lập trình',code:'501042',group:'Nhóm 5',room:'F307',dayOfWeek:1,periodStart:1,periodEnd:3,exactDate:new Date(2026,10,9).getTime()}]`, ctx);
  const googleEnglish = vm.runInContext('JSON.stringify(buildGoogleEvents(fixture))', ctx);
  const uidEnglish = vm.runInContext("generateICS(fixture).match(/UID:[^\\r\\n]+/)[0]", ctx);
  vm.runInContext("SETTINGS.language='vi'", ctx);
  assert.equal(vm.runInContext('JSON.stringify(buildGoogleEvents(fixture))', ctx), googleEnglish);
  assert.equal(vm.runInContext("generateICS(fixture).match(/UID:[^\\r\\n]+/)[0]", ctx), uidEnglish);
});
test('UI pages use only packaged local theme, localization and mascot assets', () => {
  for (const file of ['popup.html', 'options.html']) {
    const source = read(file);
    assert.match(source, /src="i18n.js"/);
    assert.match(source, /class="mascot-avatar"/);
    assert.match(source, /href="theme.css"/);
    assert.doesNotMatch(source, /toggleAmbience|miku-friend|ambience.js/);
    assert.match(source, /https:\/\/github.com\/RyuuseiAkira\/TDTU-Schedule-Exporter/);
  }
  assert.match(read('theme.css'), /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(read('assets/miku-avatar.svg'), /<script|<foreignObject|<image/);
  assert.match(read('assets/miku-avatar.svg'), /class="mascot-eyes"/);
  assert.match(read('theme.css'), /@keyframes mascot-blink/);
  assert.match(read('build.js'), /'assets'/);
});
