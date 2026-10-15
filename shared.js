// shared.js — helper dùng chung (màu, mô tả, thời gian). Thường không cần sửa.

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
let SETTINGS = JSON.parse(JSON.stringify(DEFAULTS));
async function loadSettings() {
  const r = await chrome.storage.local.get('settings');
  SETTINGS = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), r.settings || {});
  return SETTINGS;
}

// Màu của 1 lớp theo mã môn. Trả về { id, hex, css, assigned }
function colorForClass(cls) {
  const code = String(cls.code || '').trim();
  const own = SETTINGS.subjectColors[code];
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
    return /^\d+$/.test(m) ? m === code : name.indexOf(m) >= 0;
  });
}

// Lớp bị loại: nằm trong blacklist, hoặc GV báo vắng (khi bật "bỏ qua GV báo vắng")
function isExcluded(cls) {
  return isBlacklisted(cls) || (SETTINGS.ignoreAbsent && !!cls.absent);
}
