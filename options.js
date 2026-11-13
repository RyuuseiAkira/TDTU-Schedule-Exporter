// options.js — trang Settings (tự lưu vào chrome.storage.local)
let rows = [];            // [{code, name, color}]
let blacklist = [];       // [{match, name}]
let defaultColor = 'graphite';

const $ = id => document.getElementById(id);
const COLOR_KEYS = Object.keys(GOOGLE_COLORS);

// Local SVG icons keep every action consistent across browsers and operating systems.
const ICON_PATHS = {
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  hide: '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11 11 0 0 1 12 5c7 0 10 7 10 7a16 16 0 0 1-3.2 4.2M6.2 6.2A17 17 0 0 0 2 12s3 7 10 7a11 11 0 0 0 5-1.2"/>',
  restore: '<path d="M3 10h5M3 10V5m0 5a9 9 0 1 1 0 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.01"/>',
  filter: '<path d="M4 4h16l-6 8v7l-4 2v-9Z"/>',
  sliders: '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.8h2a4 4 0 0 0 4-4C21 6.4 17 3 12 3Z"/><path d="M7 10h.01M10 7h.01M15 7h.01M18 10h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3"/>',
  reset: '<path d="M3 10h5M3 10V5m0 5a9 9 0 1 1 0 5"/>'
};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ui-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = ICON_PATHS[name] || '';
  return svg;
}
document.querySelectorAll('[data-icon]').forEach(el => el.replaceChildren(icon(el.dataset.icon)));
function actionButton(name, label, onClick, text = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = text ? 'subject-action' : 'icon-action';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.append(icon(name));
  if (text) button.append(document.createTextNode(label));
  button.addEventListener('click', onClick);
  return button;
}
function labelledField(label, input) {
  const field = document.createElement('label');
  field.className = 'subject-field';
  const text = document.createElement('span');
  text.textContent = label;
  field.append(text, input);
  return field;
}
function ruleType(rule) { return rule.type || 'legacy'; }
function ruleLabel(rule) {
  return tr(rule.type === 'code' ? 'Mã môn' : rule.type === 'name' ? 'Tên chứa' : 'Mã hoặc từ khoá');
}
function exactRuleIndex(code) {
  return blacklist.findIndex(b => b.match.toLowerCase() === code.toLowerCase() && b.type !== 'name');
}

function palette(selected, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'palette';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', tr('Chọn màu'));
  COLOR_KEYS.forEach(k => {
    const b = document.createElement('button');
    b.type = 'button';
    const active = lookupColor(selected)?.id === GOOGLE_COLORS[k].id;
    b.className = 'dot' + (active ? ' sel' : '');
    b.style.background = GOOGLE_COLORS[k].hex;
    b.title = k.charAt(0).toUpperCase() + k.slice(1);
    b.setAttribute('aria-label', b.title);
    b.dataset.color = k;
    b.setAttribute('aria-pressed', String(active));
    b.addEventListener('click', () => {
      const index = Array.from(document.querySelectorAll('.palette')).indexOf(wrap);
      onPick(k);
      document.querySelectorAll('.palette')[index]?.querySelector('[data-color="' + k + '"]')?.focus();
    });
    wrap.appendChild(b);
  });
  return wrap;
}

function markDuplicates() {
  const counts = Object.create(null);
  rows.forEach(r => { if (r.code) counts[r.code] = (counts[r.code] || 0) + 1; });
  const inputs = document.querySelectorAll('#subjects .code');
  rows.forEach((r, i) => {
    const inp = inputs[i];
    if (!inp) return;
    const dup = r.code && counts[r.code] > 1;
    inp.style.borderColor = dup ? 'var(--err)' : '';
    inp.setAttribute('aria-invalid', String(!!dup));
    if (dup) inp.setAttribute('aria-describedby', 'duplicateCodes');
    else inp.removeAttribute('aria-describedby');
    inp.title = dup ? tr('Mã môn bị trùng — dòng bên dưới sẽ ghi đè dòng trên') : '';
  });
  const message = $('duplicateCodes');
  message.hidden = !rows.some(r => r.code && counts[r.code] > 1);
  message.textContent = tr('Mã môn bị trùng — dòng bên dưới sẽ ghi đè dòng trên');
}

function render() {
  const box = $('subjects');
  box.innerHTML = '';
  rows.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'row';

    const code = document.createElement('input');
    code.type = 'text'; code.className = 'code'; code.placeholder = tr('Mã môn');
    code.setAttribute('aria-label', tr('Mã môn học'));
    code.value = r.code; code.spellcheck = false;
    code.addEventListener('input', () => { r.code = code.value.trim(); updateSubjectAction(); markDuplicates(); save(); });

    const name = document.createElement('input');
    name.type = 'text'; name.className = 'name'; name.placeholder = tr('Tên môn (tuỳ chọn)');
    name.setAttribute('aria-label', tr('Tên môn học'));
    name.value = r.name;
    name.addEventListener('input', () => { r.name = name.value; updateSubjectAction(); save(); });

    const pal = palette(r.color, k => { r.color = k; save(); render(); });
    pal.setAttribute('aria-label', tr('Màu môn học') + ' ' + r.code);

    const del = actionButton('trash', tr('Xoá màu môn này'), () => {
      rows.splice(i, 1); save(); render();
      ($('subjects').querySelector('.code') || $('addRow')).focus();
    });
    let hidden = blacklist.some(rule => matchesFilter({code:r.code, name:r.name}, rule));
    let directHidden = r.code && exactRuleIndex(r.code) >= 0;
    const ban = actionButton(directHidden ? 'restore' : hidden ? 'filter' : 'hide', tr(directHidden ? 'Khôi phục' : hidden ? 'Xem bộ lọc' : 'Ẩn môn'), () => {
      if (hidden && !directHidden) {
        $('excluded').scrollIntoView({block:'start'});
        const index = blacklist.findIndex(rule => matchesFilter({code:r.code, name:r.name}, rule));
        $('blacklist').children[index]?.querySelector('button')?.focus({preventScroll:true});
        return;
      }
      if (!r.code) { code.focus(); return; }
      const index = exactRuleIndex(r.code);
      if (index >= 0) blacklist.splice(index, 1);
      else blacklist.push({ match: r.code, name: r.name, type: 'code' });
      save(); render();
      $('subjects').children[i]?.querySelector('.subject-action')?.focus();
    }, true);
    function updateSubjectAction() {
      hidden = blacklist.some(rule => matchesFilter({code:r.code, name:r.name}, rule));
      directHidden = r.code && exactRuleIndex(r.code) >= 0;
      const label = tr(directHidden ? 'Khôi phục' : hidden ? 'Xem bộ lọc' : 'Ẩn môn');
      ban.replaceChildren(icon(directHidden ? 'restore' : hidden ? 'filter' : 'hide'), document.createTextNode(label));
      ban.title = label;
      ban.setAttribute('aria-label', label);
      ban.disabled = !r.code;
      row.classList.toggle('subject-hidden', hidden);
      pal.setAttribute('aria-label', tr('Màu môn học') + ' ' + r.code);
    }
    updateSubjectAction();
    const actions = document.createElement('div'); actions.className = 'subject-actions';
    actions.append(ban, del);
    const colorField = document.createElement('div'); colorField.className = 'subject-palette';
    const colorLabel = document.createElement('span'); colorLabel.textContent = tr('Màu sự kiện');
    colorField.append(colorLabel, pal);
    const controls = document.createElement('div'); controls.className = 'subject-controls';
    controls.append(colorField, actions);
    row.append(labelledField(tr('Mã môn'), code), labelledField(tr('Tên môn (tuỳ chọn)'), name), controls);
    box.appendChild(row);
  });
  if (!rows.length) box.innerHTML = tr('<p class="hint">Chưa có môn nào. Bấm “Thêm môn”.</p>');

  const bl = $('blacklist');
  bl.innerHTML = '';
  blacklist.forEach((b, i) => {
    const row = document.createElement('div'); row.className = 'hidden-rule';
    const content = document.createElement('div'); content.className = 'hidden-rule-content';
    const kind = document.createElement('span'); kind.className = 'rule-kind'; kind.textContent = ruleLabel(b);
    const value = document.createElement('strong'); value.textContent = b.match;
    content.append(kind, value);
    if (b.name) { const note = document.createElement('small'); note.textContent = b.name; content.append(note); }
    const restore = actionButton('restore', tr('Khôi phục'), () => {
      blacklist.splice(i, 1); save(); render();
      ($('blacklist').querySelector('button') || $('filterMatch')).focus();
    }, true);
    row.append(icon('hide'), content, restore); bl.append(row);
  });
  if (!blacklist.length) {
    const empty = document.createElement('p'); empty.className = 'filter-empty';
    empty.textContent = tr('Chưa ẩn môn nào. Thêm mã môn hoặc từ khoá ở trên.'); bl.append(empty);
  }
  $('filterCount').textContent = SETTINGS.language === 'vi' ? blacklist.length + ' quy tắc' : blacklist.length + (blacklist.length === 1 ? ' rule' : ' rules');
  updateFilterField();

  const dp = $('defaultPalette');
  dp.replaceWith(Object.assign(palette(defaultColor, k => { defaultColor = k; save(); render(); }), { id: 'defaultPalette' }));
  markDuplicates();
}

let timer;
let savingSelf = false;
function save() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const subjectColors = Object.create(null), subjectNames = Object.create(null);
    rows.forEach(r => {
      if (!r.code) return;
      subjectColors[r.code] = r.color;
      if (r.name) subjectNames[r.code] = r.name;
    });
    savingSelf = true;
    try {
      await ext.storage.local.set({ settings: {
        subjectColors, subjectNames, defaultColor, language: $('language').value, animateMascot: $('animateMascot').checked,
        blacklist: blacklist.filter(b => b.match),
        ignoreAbsent: $('ignoreAbsent').checked,
        clientId: $('clientId').value.trim(),
        calendarId: $('calendarId').value.trim() || 'primary'
      }});
    } catch {
      showSettingsNotice(tr('Không lưu được cài đặt. Vui lòng thử lại.'), true);
      return;
    } finally {
      setTimeout(() => { savingSelf = false; }, 100);
    }
    showSettingsNotice(tr('Đã lưu ✓'));
  }, 350);
}

function loadIntoUI(s) {
  SETTINGS.animateMascot = s.animateMascot !== false;
  $('animateMascot').checked = SETTINGS.animateMascot;
  applyLanguage(s.language);
  $('language').value = s.language || 'en';
  rows = Object.keys(s.subjectColors).map(code => ({
    code, name: (s.subjectNames || {})[code] || '', color: s.subjectColors[code]
  }));
  defaultColor = s.defaultColor;
  $('ignoreAbsent').checked = !!s.ignoreAbsent;
  blacklist = (s.blacklist || []).map(b => ({ match: b.match, name: b.name || '', ...(b.type ? {type:b.type} : {}) }));
  $('clientId').value = s.clientId || '';
  $('calendarId').value = s.calendarId || 'primary';
  validateClientId();
  render();
}

$('addRow').addEventListener('click', () => {
  rows.push({ code: '', name: '', color: 'lavender' });
  render();
  const inputs = document.querySelectorAll('#subjects .code');
  if (inputs.length) inputs[inputs.length - 1].focus();
});

function updateFilterField() {
  const code = $('filterType').value === 'code';
  $('filterMatchLabel').textContent = tr($('filterType').value === 'legacy' ? 'Mã hoặc từ khoá' : code ? 'Mã môn' : 'Tên chứa');
  $('filterMatch').placeholder = tr($('filterType').value === 'legacy' ? 'Ví dụ: 501042 hoặc tiếng anh' : code ? 'Ví dụ: 501042' : 'Ví dụ: tiếng anh');
}
$('filterType').addEventListener('change', () => { updateFilterField(); $('filterError').hidden = true; $('filterMatch').removeAttribute('aria-invalid'); });
$('filterMatch').addEventListener('input', () => { $('filterError').hidden = true; $('filterMatch').removeAttribute('aria-invalid'); });
$('filterForm').addEventListener('submit', event => {
  event.preventDefault();
  const match = cleanStr($('filterMatch').value, 100), type = $('filterType').value;
  const error = blacklist.length >= 100 ? 'Tối đa 100 quy tắc. Khôi phục một môn trước khi thêm.' : !match ? 'Nhập mã môn hoặc từ khoá để ẩn.' : blacklist.some(b => b.match.toLowerCase() === match.toLowerCase() && ruleType(b) === type) ? 'Quy tắc này đã có trong danh sách.' : '';
  if (error) {
    $('filterError').textContent = tr(error); $('filterError').hidden = false;
    $('filterMatch').setAttribute('aria-invalid', 'true'); $('filterMatch').focus(); return;
  }
  blacklist.push({ match, name: '', ...(type === 'legacy' ? {} : {type}) });
  $('filterMatch').value = ''; $('filterMatch').removeAttribute('aria-invalid');
  save(); render(); $('filterMatch').focus();
});

$('copyRedirect').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('redirect').value); }
  catch { showSettingsNotice(tr('Không sao chép được. Hãy chọn và sao chép Redirect URI.'), true); return; }
  $('copyRedirect').textContent = tr('Đã copy ✓');
  setTimeout(() => $('copyRedirect').textContent = tr('Sao chép'), 1200);
});

$('reset').addEventListener('click', async () => {
  if (!confirm(tr('Khôi phục toàn bộ cài đặt về mặc định?'))) return;
  clearTimeout(timer);
  await ext.storage.local.remove('settings');
  loadIntoUI(JSON.parse(JSON.stringify(DEFAULTS)));
});

$('ignoreAbsent').addEventListener('change', save);
$('clientId').addEventListener('input', () => {
  validateClientId();
  save();
});
$('calendarId').addEventListener('input', save);

(async function init() {
  $('redirect').value = ext.identity.getRedirectURL();
  loadIntoUI(await loadSettings());
  ext.storage.onChanged.addListener(async (ch, area) => {
    if (area === 'local' && ch.settings && !savingSelf) {
      loadIntoUI(await loadSettings());
    }
  });
})();

// Client ID stays masked unless the user explicitly reveals it.
const revealClientId = $('toggleClientId');
function maskClientId() {
  $('clientId').type = 'password';
  revealClientId.setAttribute('aria-pressed', 'false');
  revealClientId.setAttribute('aria-label', tr('Hiện Client ID'));
  revealClientId.title = tr('Hiện Client ID');
}
revealClientId.addEventListener('click', () => {
  const show = $('clientId').type === 'password';
  $('clientId').type = show ? 'text' : 'password';
  revealClientId.setAttribute('aria-pressed', String(show));
  revealClientId.setAttribute('aria-label', show ? tr('Ẩn Client ID') : tr('Hiện Client ID'));
  revealClientId.title = show ? tr('Ẩn Client ID') : tr('Hiện Client ID');
});
document.addEventListener('visibilitychange', () => { if (document.hidden) maskClientId(); });

$('language').addEventListener('change', () => { applyLanguage($('language').value); maskClientId(); render(); save(); });

$('animateMascot').addEventListener('change', () => { SETTINGS.animateMascot = $('animateMascot').checked; document.body.classList.toggle('motion-off', !SETTINGS.animateMascot); save(); });

function validateClientId() {
  const value = $('clientId').value.trim();
  const invalid = !!value && !/^[0-9A-Za-z._-]{5,120}\.apps\.googleusercontent\.com$/.test(value);
  $('clientIdHint').style.display = invalid ? 'block' : 'none';
  $('clientId').setAttribute('aria-invalid', String(invalid));
}
let noticeTimer;
function showSettingsNotice(message, error = false) {
  clearTimeout(noticeTimer);
  $('saved').textContent = message;
  $('saved').classList.toggle('error', error);
  $('saved').classList.add('show');
  markUIFeedback($('saved'));
  noticeTimer = setTimeout(() => $('saved').classList.remove('show'), error ? 6000 : 1600);
}

// Keep the navigation location in sync with both anchor clicks and manual scrolling.
(() => {
  const links = Array.from(document.querySelectorAll('.settings-nav a'));
  const sections = links.map(link => document.querySelector(link.getAttribute('href')));
  function activate(index) {
    links.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function updateLocation() {
    const boundary = Math.min(150, window.innerHeight * .22);
    let current = 0;
    sections.forEach((section, i) => { if (section.getBoundingClientRect().top <= boundary) current = i; });
    activate(current);
  }
  let frame = 0;
  function scheduleLocationUpdate() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; updateLocation(); });
  }
  links.forEach((link, index) => link.addEventListener('click', () => activate(index)));
  window.addEventListener('scroll', scheduleLocationUpdate, {passive:true});
  window.addEventListener('resize', scheduleLocationUpdate);
  window.addEventListener('hashchange', scheduleLocationUpdate);
  document.fonts?.ready.then(scheduleLocationUpdate);
  updateLocation();
})();
