// options.js — trang Settings (tự lưu vào chrome.storage.local)
let rows = [];            // [{code, name, color}]
let blacklist = [];       // [{match, name}]
let defaultColor = 'graphite';

const $ = id => document.getElementById(id);
const COLOR_KEYS = Object.keys(GOOGLE_COLORS);

function palette(selected, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'palette';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', tr('Chọn màu'));
  COLOR_KEYS.forEach(k => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dot' + (k === selected ? ' sel' : '');
    b.style.background = GOOGLE_COLORS[k].hex;
    b.title = k.charAt(0).toUpperCase() + k.slice(1);
    b.setAttribute('aria-label', b.title);
    b.dataset.color = k;
    b.setAttribute('aria-pressed', String(k === selected));
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
    code.addEventListener('input', () => { r.code = code.value.trim(); markDuplicates(); save(); });

    const name = document.createElement('input');
    name.type = 'text'; name.className = 'name'; name.placeholder = tr('Tên môn (tuỳ chọn)');
    name.setAttribute('aria-label', tr('Tên môn học'));
    name.value = r.name;
    name.addEventListener('input', () => { r.name = name.value; save(); });

    const pal = palette(r.color, k => { r.color = k; save(); render(); });
    pal.setAttribute('aria-label', tr('Màu môn học') + ' ' + r.code);

    const del = document.createElement('button');
    del.type = 'button'; del.className = 'del'; del.title = tr('Xoá'); del.setAttribute('aria-label', del.title); del.textContent = '🗑';
    del.addEventListener('click', () => { rows.splice(i, 1); save(); render(); });

    const ban = document.createElement('button');
    ban.type = 'button'; ban.className = 'del'; ban.title = tr('Đưa vào blacklist'); ban.setAttribute('aria-label', ban.title); ban.textContent = '🚫';
    ban.addEventListener('click', () => {
      if (r.code && !blacklist.some(b => b.match === r.code)) blacklist.push({ match: r.code, name: r.name });
      rows.splice(i, 1); save(); render();
    });

    row.append(code, name, pal, ban, del);
    box.appendChild(row);
  });
  if (!rows.length) box.innerHTML = tr('<p class="hint">Chưa có môn nào. Bấm “Thêm môn”.</p>');

  const bl = $('blacklist');
  bl.innerHTML = '';
  blacklist.forEach((b, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    const m = document.createElement('input');
    m.type = 'text'; m.className = 'code'; m.style.width = '150px'; m.placeholder = tr('Mã môn / từ khoá');
    m.setAttribute('aria-label', tr('Mã môn hoặc từ khóa cần ẩn'));
    m.value = b.match; m.spellcheck = false;
    m.addEventListener('input', () => { b.match = m.value.trim(); save(); });
    const n = document.createElement('input');
    n.type = 'text'; n.className = 'name'; n.placeholder = tr('Ghi chú (tuỳ chọn)');
    n.setAttribute('aria-label', tr('Ghi chú môn ẩn'));
    n.value = b.name || '';
    n.addEventListener('input', () => { b.name = n.value; save(); });
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'del'; del.title = tr('Bỏ khỏi blacklist'); del.setAttribute('aria-label', del.title); del.textContent = '🗑';
    del.addEventListener('click', () => { blacklist.splice(i, 1); save(); render(); });
    row.append(m, n, del);
    bl.appendChild(row);
  });
  if (!blacklist.length) bl.innerHTML = tr('<p class="hint">Blacklist trống.</p>');

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
  blacklist = (s.blacklist || []).map(b => ({ match: b.match, name: b.name || '' }));
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

$('addBlack').addEventListener('click', () => {
  blacklist.push({ match: '', name: '' });
  render();
  const inputs = document.querySelectorAll('#blacklist .code');
  inputs[inputs.length - 1].focus();
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
