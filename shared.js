// shared.js — helper dùng chung (màu, mô tả, thời gian). Thường không cần sửa.

// Tương thích Chrome / Edge / Firefox: Firefox dùng `browser.*` (trả về Promise),
// Chrome dùng `chrome.*` (MV3 cũng trả về Promise). Toàn bộ code dùng `ext.*`.
const ext = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

// 11 màu sự kiện cố định của Google Calendar: tên → { id, hex, css }
// (css = tên màu CSS gần nhất, dùng cho thuộc tính COLOR trong .ics cho app khác)
const GOOGLE_COLORS = {
  lavender:  { id: '1',  hex: '#7986CB', css: 'slateblue'   },
  sage:      { id: '2',  hex: '#33B679', css: 'mediumseagreen' },
  grape:     { id: '3',  hex: '#8E24AA', css: 'purple'      },
  flamingo:  { id: '4',  hex: '#E67C73', css: 'salmon'      },
  banana:    { id: '5',  hex: '#F6BF26', css: 'gold'        },
  tangerine: { id: '6',  hex: '#F4511E', css: 'orangered'   },
  peacock:   { id: '7',  hex: '#039BE5', css: 'deepskyblue' },
  graphite:  { id: '8',  hex: '#616161', css: 'dimgray'     },
  blueberry: { id: '9',  hex: '#3F51B5', css: 'royalblue'   },
  basil:     { id: '10', hex: '#0B8043', css: 'seagreen'    },
  tomato:    { id: '11', hex: '#D50000', css: 'crimson'     }
};

// Chấp nhận tên ('Tomato', 'tomato') hoặc số (11, '11'); sai → màu mặc định
function lookupColor(value) {
  const v = String(value == null ? '' : value).trim().toLowerCase();
  if (GOOGLE_COLORS[v]) return GOOGLE_COLORS[v];
  for (const k in GOOGLE_COLORS) if (GOOGLE_COLORS[k].id === v) return GOOGLE_COLORS[k];
  return null;
}

// ─── Settings (lưu ở chrome.storage.local, mặc định lấy từ config.js) ───────
// ─── Làm sạch dữ liệu (dữ liệu từ trang web / storage đều không được tin cậy) ───
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlainObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// Chuỗi: bỏ ký tự điều khiển (kể cả xuống dòng), gộp khoảng trắng, giới hạn độ dài
function cleanStr(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanInt(v, lo, hi) {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

// Lớp học đọc từ trang TDTU → chỉ giữ các trường hợp lệ; sai định dạng thì bỏ (null)
function sanitizeClass(c) {
  if (!isPlainObj(c)) return null;
  const name = cleanStr(c.name, 200);
  const ps = cleanInt(c.periodStart, 1, 16), pe = cleanInt(c.periodEnd, 1, 16), dow = cleanInt(c.dayOfWeek, 0, 6);
  if (!name || ps === null || pe === null || dow === null || pe < ps) return null;
  let ex = c.exactDate == null ? null : Number(c.exactDate);
  if (ex !== null && !(Number.isFinite(ex) && ex > 946684800000 && ex < 4102444800000)) ex = null; // năm 2000–2100
  return {
    name, engName: cleanStr(c.engName, 200), code: cleanStr(c.code, 16), room: cleanStr(c.room, 100),
    group: cleanStr(c.group, 60), note: cleanStr(c.note, 100),
    dayOfWeek: dow, periodStart: ps, periodEnd: pe, exactDate: ex, absent: c.absent === true
  };
}

// Settings đọc từ chrome.storage → ép về đúng kiểu, thiếu / sai thì dùng mặc định
function sanitizeSettings(raw) {
  const out = JSON.parse(JSON.stringify(DEFAULTS));
  if (!isPlainObj(raw)) return out;
  if (isPlainObj(raw.subjectColors)) {
    out.subjectColors = {};
    Object.keys(raw.subjectColors).slice(0, 200).forEach(function(k) {
      const code = cleanStr(k, 16);
      if (code && lookupColor(raw.subjectColors[k])) out.subjectColors[code] = String(raw.subjectColors[k]).toLowerCase();
    });
  }
  if (isPlainObj(raw.subjectNames)) {
    out.subjectNames = {};
    Object.keys(raw.subjectNames).slice(0, 200).forEach(function(k) {
      const code = cleanStr(k, 16), n = cleanStr(raw.subjectNames[k], 100);
      if (code && n) out.subjectNames[code] = n;
    });
  }
  if (Array.isArray(raw.blacklist)) {
    out.blacklist = raw.blacklist.slice(0, 100).filter(isPlainObj)
      .map(b => ({ match: cleanStr(b.match, 100), name: cleanStr(b.name, 100) }))
      .filter(b => b.match);
  }
  if (typeof raw.ignoreAbsent === 'boolean') out.ignoreAbsent = raw.ignoreAbsent;
  if (lookupColor(raw.defaultColor)) out.defaultColor = String(raw.defaultColor).toLowerCase();
  if (typeof raw.clientId === 'string') out.clientId = cleanStr(raw.clientId, 120);
  if (typeof raw.calendarId === 'string') out.calendarId = cleanStr(raw.calendarId, 255) || 'primary';
  return out;
}

// ─── Settings (lưu ở chrome.storage.local, mặc định lấy từ config.js) ───────
let SETTINGS = JSON.parse(JSON.stringify(DEFAULTS));
async function loadSettings() {
  const r = await ext.storage.local.get('settings');
  SETTINGS = sanitizeSettings(r.settings);
  return SETTINGS;
}

// Màu của 1 lớp theo mã môn. Trả về { id, hex, css, assigned }
function colorForClass(cls) {
  const code = String(cls.code || '').trim();
  const own = hasOwn(SETTINGS.subjectColors, code) ? SETTINGS.subjectColors[code] : undefined;
  const found = own !== undefined ? lookupColor(own) : null;
  if (found) return Object.assign({ assigned: true }, found);
  const def = lookupColor(SETTINGS.defaultColor) || GOOGLE_COLORS.graphite;
  return Object.assign({ assigned: false }, def);
}

// Mô tả sự kiện, dạng: "Nhóm 5 | Mã: 501042 | Programming Methodology | ghi chú"
function buildDescription(cls) {
  const d = [];
  if (cls.group)   d.push(cls.group);
  if (cls.code)    d.push('Mã: ' + cls.code);
  if (cls.engName) d.push(cls.engName);
  if (cls.note)    d.push(cls.note);
  return d.join(' | ');
}

// Ngày của lớp (ưu tiên ngày đọc từ tiêu đề trang)
function classBaseDate(cls) {
  if (cls.exactDate) return new Date(cls.exactDate);
  const today = new Date();
  const base = new Date(today);
  base.setDate(today.getDate() + (cls.dayOfWeek - today.getDay()));
  return base;
}

// 'YYYY-MM-DD' + 'HH:MM' → 'YYYY-MM-DDTHH:MM:00'
function localDateTime(date, hhmm) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d + 'T' + hhmm + ':00';
}

// Lớp có nằm trong blacklist không? match toàn số = mã môn; còn lại = từ khoá trong tên
function isBlacklisted(cls) {
  const code = String(cls.code || '').trim();
  const name = String(cls.name || '').toLowerCase();
  return (SETTINGS.blacklist || []).some(function(b) {
    const m = String(b && b.match || '').trim().toLowerCase();
    if (!m) return false;
    return m === code.toLowerCase() || (!/^\d+$/.test(m) && name.indexOf(m) >= 0);
  });
}

// Lớp bị loại: nằm trong blacklist, hoặc GV báo vắng (khi bật "bỏ qua GV báo vắng")
function isExcluded(cls) {
  return isBlacklisted(cls) || (SETTINGS.ignoreAbsent && !!cls.absent);
}

// Tìm các cặp lớp trùng giờ (cùng ngày, khoảng tiết giao nhau).
// Trả về [{ a, b, from, to }] — from/to là khoảng tiết bị trùng.
function findOverlaps(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const sameDay = (a.exactDate && b.exactDate) ? a.exactDate === b.exactDate : a.dayOfWeek === b.dayOfWeek;
      if (!sameDay) continue;
      const from = Math.max(a.periodStart, b.periodStart);
      const to = Math.min(a.periodEnd, b.periodEnd);
      if (from <= to) out.push({ a: a, b: b, from: from, to: to });
    }
  }
  return out;
}
