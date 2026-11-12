// options.js — trang Settings (tự lưu vào chrome.storage.local)
let rows = [];            // [{code, name, color}]
let blacklist = [];       // [{match, name}]
let defaultColor = 'graphite';

const $ = id => document.getElementById(id);
const COLOR_KEYS = Object.keys(GOOGLE_COLORS);

function palette(selected, onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'palette';
  COLOR_KEYS.forEach(k => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dot' + (k === selected ? ' sel' : '');
    b.style.background = GOOGLE_COLORS[k].hex;
    b.title = k.charAt(0).toUpperCase() + k.slice(1);
    b.addEventListener('click', () => onPick(k));
    wrap.appendChild(b);
  });
  return wrap;
}

function markDuplicates() {
  const counts = {};
  rows.forEach(r => { if (r.code) counts[r.code] = (counts[r.code] || 0) + 1; });
  const inputs = document.querySelectorAll('#subjects .code');
  rows.forEach((r, i) => {
    const inp = inputs[i];
    if (!inp) return;
    const dup = r.code && counts[r.code] > 1;
    inp.style.borderColor = dup ? 'var(--err)' : '';
    inp.title = dup ? 'Mã môn bị trùng — dòng bên dưới sẽ ghi đè dòng trên' : '';
  });
}

function render() {
  const box = $('subjects');
  box.innerHTML = '';
  rows.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'row';

    const code = document.createElement('input');
    code.type = 'text'; code.className = 'code'; code.placeholder = 'Mã môn';
    code.value = r.code; code.spellcheck = false;
    code.addEventListener('input', () => { r.code = code.value.trim(); markDuplicates(); save(); });

    const name = document.createElement('input');
    name.type = 'text'; name.className = 'name'; name.placeholder = 'Tên môn (tuỳ chọn)';
    name.value = r.name;
    name.addEventListener('input', () => { r.name = name.value; save(); });

    const pal = palette(r.color, k => { r.color = k; save(); render(); });

    const del = document.createElement('button');
    del.type = 'button'; del.className = 'del'; del.title = 'Xoá'; del.textContent = '🗑';
    del.addEventListener('click', () => { rows.splice(i, 1); save(); render(); });

    const ban = document.createElement('button');
    ban.type = 'button'; ban.className = 'del'; ban.title = 'Đưa vào blacklist'; ban.textContent = '🚫';
    ban.addEventListener('click', () => {
      if (r.code && !blacklist.some(b => b.match === r.code)) blacklist.push({ match: r.code, name: r.name });
      rows.splice(i, 1); save(); render();
    });

    row.append(code, name, pal, ban, del);
    box.appendChild(row);
  });
  if (!rows.length) box.innerHTML = '<p class="hint">Chưa có môn nào. Bấm “Thêm môn”.</p>';

  const bl = $('blacklist');
  bl.innerHTML = '';
  blacklist.forEach((b, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    const m = document.createElement('input');
    m.type = 'text'; m.className = 'code'; m.style.width = '150px'; m.placeholder = 'Mã môn / từ khoá';
    m.value = b.match; m.spellcheck = false;
    m.addEventListener('input', () => { b.match = m.value.trim(); save(); });
    const n = document.createElement('input');
    n.type = 'text'; n.className = 'name'; n.placeholder = 'Ghi chú (tuỳ chọn)';
    n.value = b.name || '';
    n.addEventListener('input', () => { b.name = n.value; save(); });
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'del'; del.title = 'Bỏ khỏi blacklist'; del.textContent = '🗑';
    del.addEventListener('click', () => { blacklist.splice(i, 1); save(); render(); });
    row.append(m, n, del);
    bl.appendChild(row);
  });
  if (!blacklist.length) bl.innerHTML = '<p class="hint">Blacklist trống.</p>';

  const dp = $('defaultPalette');
  dp.replaceWith(Object.assign(palette(defaultColor, k => { defaultColor = k; save(); render(); }), { id: 'defaultPalette' }));
  markDuplicates();
}

let timer;
let savingSelf = false;
function save() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const subjectColors = {}, subjectNames = {};
    rows.forEach(r => {
      if (!r.code) return;
      subjectColors[r.code] = r.color;
      if (r.name) subjectNames[r.code] = r.name;
    });
    savingSelf = true;
    try {
      await ext.storage.local.set({ settings: {
        subjectColors, subjectNames, defaultColor,
        blacklist: blacklist.filter(b => b.match),
        ignoreAbsent: $('ignoreAbsent').checked,
        clientId: $('clientId').value.trim(),
        calendarId: $('calendarId').value.trim() || 'primary'
      }});
    } finally {
      setTimeout(() => { savingSelf = false; }, 100);
    }
    $('saved').classList.add('show');
    setTimeout(() => $('saved').classList.remove('show'), 1200);
  }, 350);
}

function loadIntoUI(s) {
  rows = Object.keys(s.subjectColors).map(code => ({
    code, name: (s.subjectNames || {})[code] || '', color: s.subjectColors[code]
  }));
  defaultColor = s.defaultColor;
  $('ignoreAbsent').checked = !!s.ignoreAbsent;
  blacklist = (s.blacklist || []).map(b => ({ match: b.match, name: b.name || '' }));
  $('clientId').value = s.clientId || '';
  $('calendarId').value = s.calendarId || 'primary';
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
  await navigator.clipboard.writeText($('redirect').value);
  $('copyRedirect').textContent = 'Đã copy ✓';
  setTimeout(() => $('copyRedirect').textContent = 'Copy', 1200);
});

$('reset').addEventListener('click', async () => {
  if (!confirm('Khôi phục toàn bộ cài đặt về mặc định?')) return;
  await ext.storage.local.remove('settings');
  loadIntoUI(JSON.parse(JSON.stringify(DEFAULTS)));
});

$('ignoreAbsent').addEventListener('change', save);
$('clientId').addEventListener('input', () => {
  const v = $('clientId').value.trim();
  $('clientIdHint').style.display = v && !/^[0-9A-Za-z._-]{5,120}\.apps\.googleusercontent\.com$/.test(v) ? 'block' : 'none';
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
