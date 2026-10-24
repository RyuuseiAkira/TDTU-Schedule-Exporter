// popup.js — TDTU Schedule Exporter v4
// Properly handles rowspan in weekly calendar grid

let scheduleData = [];
// Dữ liệu sau khi loại các môn trong blacklist (dùng cho hiển thị + xuất + đồng bộ)
function visibleData() { return scheduleData.filter(function(c) { return !isExcluded(c); }); }

const PORTAL_URL   = 'https://stdportal.tdtu.edu.vn';
const SCHEDULE_URL = 'https://lichhoc-lichthi.tdtu.edu.vn';

function isOnPortal(url)   { return url && url.startsWith(PORTAL_URL); }
function isOnSchedule(url) { return url && url.startsWith(SCHEDULE_URL); }
function isOnTDTU(url)     { return isOnPortal(url) || isOnSchedule(url); }

// ─── TDTU official period times ───────────────────────────────────────────────
const PERIOD_TIMES = {
   1:{s:'06:50',e:'07:40'}, 2:{s:'07:40',e:'08:30'}, 3:{s:'08:30',e:'09:20'},
   4:{s:'09:30',e:'10:20'}, 5:{s:'10:20',e:'11:10'}, 6:{s:'11:10',e:'12:00'},
   7:{s:'12:45',e:'13:35'}, 8:{s:'13:35',e:'14:25'}, 9:{s:'14:25',e:'15:15'},
  10:{s:'15:25',e:'16:15'},11:{s:'16:15',e:'17:05'},12:{s:'17:05',e:'17:55'},
  13:{s:'18:05',e:'18:55'},14:{s:'18:55',e:'19:45'},15:{s:'19:45',e:'20:35'},
  16:{s:'20:35',e:'21:25'}
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const statusBanner      = document.getElementById('statusBanner');
const statusDot         = document.getElementById('statusDot');
const statusText        = document.getElementById('statusText');
const fetchBtn          = document.getElementById('fetchBtn');
const exportBtns        = document.getElementById('exportBtns');
const exportICS         = document.getElementById('exportICS');
const exportExcel       = document.getElementById('exportExcel');
const scheduleContainer = document.getElementById('scheduleContainer');
const classList         = document.getElementById('classList');
const countBadge        = document.getElementById('countBadge');
const notOnPortal       = document.getElementById('notOnPortal');
const openPortalBtn     = document.getElementById('openPortalBtn');

function setStatus(type, msg) {
  statusBanner.className = 'status-banner ' + type;
  statusText.textContent = msg;
  const c = {idle:'var(--text-dim)',loading:'var(--accent2)',success:'var(--success)',error:'var(--error)'};
  statusDot.style.background = c[type] || 'var(--text-dim)';
  statusDot.className = type === 'loading' ? 'dot pulse' : 'dot';
}

openPortalBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: PORTAL_URL });
  window.close();
});

function showGuideMessage() {
  let g = document.getElementById('guideMsg');
  if (g) { g.style.display = 'block'; return; }
  g = document.createElement('div');
  g.id = 'guideMsg';
  g.style.cssText = 'background:rgba(232,93,38,.08);border:1px solid rgba(232,93,38,.3);border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:#f4a261;line-height:1.6;';
  g.innerHTML = '<strong>Bạn đang ở Student Portal.</strong><br>Vào mục <em>Thời khoá biểu</em> để mở trang lịch (<code style="font-size:10px;background:#0f1117;padding:1px 4px;border-radius:4px">lichhoc-lichthi.tdtu.edu.vn</code>), rồi nhấn lại nút bên dưới.';
  fetchBtn.parentElement.insertBefore(g, fetchBtn);
}
function hideGuideMessage() {
  const g = document.getElementById('guideMsg');
  if (g) g.style.display = 'none';
}

fetchBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab ? tab.url : '';

  if (!isOnTDTU(url)) {
    notOnPortal.style.display = 'block';
    fetchBtn.style.display = 'none';
    setStatus('error', 'Vui lòng mở trang lịch học TDTU trước');
    return;
  }
  if (isOnPortal(url) && !isOnSchedule(url)) {
    showGuideMessage();
    setStatus('error', 'Đang ở Student Portal — cần mở trang Thời khoá biểu');
    return;
  }

  notOnPortal.style.display = 'none';
  hideGuideMessage();
  fetchBtn.disabled = true;
  fetchBtn.innerHTML = '<div class="spinner"></div> Đang lấy lịch...';
  setStatus('loading', 'Đang đọc lịch theo tuần...');

  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeWeeklyCalendar
    });

    const data = result[0] && result[0].result;

    if (!data || data.length === 0) {
      setStatus('error', 'Không tìm thấy dữ liệu. Trang có thể chưa load xong — thử lại.');
      fetchBtn.disabled = false;
      fetchBtn.innerHTML = '🔄 Thử lại';
      return;
    }

    scheduleData = data;
    renderSchedule(data);
    setStatus('success', 'Đã tải ' + visibleData().length + ' môn học thành công ✓');
    fetchBtn.innerHTML = '🔄 Tải lại';
    fetchBtn.disabled = false;
    exportBtns.style.display = 'grid';
    scheduleContainer.classList.add('visible');

  } catch (err) {
    setStatus('error', 'Lỗi: ' + (err.message || 'Không thể đọc trang'));
    fetchBtn.disabled = false;
    fetchBtn.innerHTML = '📅 Lấy lịch học';
  }
});

// Gán màu (chưa dùng) cho các môn chưa khai báo và lưu vào Settings
async function addMissingToSettings(data) {
  await loadSettings();
  var used = {}; Object.keys(SETTINGS.subjectColors).forEach(function(k) { used[String(SETTINGS.subjectColors[k]).toLowerCase()] = 1; });
  var free = Object.keys(GOOGLE_COLORS).filter(function(k) { return !used[k]; });
  var all = Object.keys(GOOGLE_COLORS), n = 0;
  data.forEach(function(c) {
    if (!c.code || SETTINGS.subjectColors[c.code] !== undefined) return;
    SETTINGS.subjectColors[c.code] = free.length ? free.shift() : all[n % all.length];
    SETTINGS.subjectNames[c.code] = c.name;
    n++;
  });
  await chrome.storage.local.set({ settings: SETTINGS });
}

function renderSchedule(all) {
  classList.innerHTML = '';
  const data = all.filter(function(c) { return !isExcluded(c); });
  const hidden = all.length - data.length;
  countBadge.textContent = data.length;
  let hb = document.getElementById('hiddenNote');
  if (!hb) {
    hb = document.createElement('div'); hb.id = 'hiddenNote';
    hb.style.cssText = 'font-size:11px;color:var(--text-dim);margin-bottom:8px';
    classList.parentElement.insertBefore(hb, classList);
  }
  hb.textContent = hidden ? '🚫 Đã ẩn ' + hidden + ' lớp (blacklist / GV báo vắng — chỉnh trong ⚙️ Settings)' : '';
  const days = ['CN','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
  const missing = {};
  data.forEach(function(cls) { if (!colorForClass(cls).assigned) missing[cls.code || '(không có mã)'] = cls.name; });
  const missKeys = Object.keys(missing);
  const hint = document.getElementById('colorHint');
  if (missKeys.length) {
    hint.style.display = 'block';
    hint.textContent = '🎨 Chưa gán màu (đang dùng màu mặc định): ' +
      missKeys.map(function(k){ return k + ' – ' + missing[k]; }).join(', ') +
      '. ';
    var addBtn = document.createElement('button');
    addBtn.textContent = '➕ Thêm vào Settings';
    addBtn.style.cssText = 'margin-left:4px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer';
    addBtn.addEventListener('click', function() { addMissingToSettings(data); });
    hint.appendChild(addBtn);
  } else { hint.style.display = 'none'; }
  data.forEach(function(cls) {
    const pt  = PERIOD_TIMES[cls.periodStart] || {s:'?',e:'?'};
    const pte = PERIOD_TIMES[cls.periodEnd]   || pt;
    const card = document.createElement('div');
    card.className = 'class-card';
    var col = colorForClass(cls);
    card.style.borderLeft = '4px solid ' + col.hex;
    card.innerHTML =
      '<div class="class-name">' + escHtml(cls.name) + '</div>' +
      '<div class="class-meta">' +
        '<span class="badge day">📆 ' + (days[cls.dayOfWeek] || 'N/A') + '</span>' +
        '<span class="badge time">⏰ ' + pt.s + '–' + pte.e + ' (Tiết ' + cls.periodStart + '–' + cls.periodEnd + ')</span>' +
        (cls.room  ? '<span class="badge room">📍 ' + escHtml(cls.room)  + '</span>' : '') +
        (cls.group ? '<span class="badge" style="color:#67e8f9;border-color:rgba(103,232,249,.25)">👥 ' + escHtml(cls.group) + '</span>' : '') +
        (cls.note  ? '<span class="badge" style="color:#fbbf24;border-color:rgba(251,191,36,.25)">⚠️ ' + escHtml(cls.note)  + '</span>' : '') +
      '</div>';
    classList.appendChild(card);
  });
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPER — injected into tkb2.aspx
//
// The page is a TABLE where:
//   Row 0    : header  → col 0 = "Tiết|Period", col 1..7 = day names
//   Rows 1.. : col 0 = period number (1-16), col 1..7 = class cells
//
// KEY INSIGHT: a class cell has rowspan = number of periods it spans.
// We must build a virtual 2D grid first (expanding rowspan),
// then collect ONLY cells that ORIGINATE at that row (not just occupied).
// ─────────────────────────────────────────────────────────────────────────────
function scrapeWeeklyCalendar() {

  // ── 1. Find the schedule table ─────────────────────────────────────────────
  var schedTable = null;
  var tables = document.querySelectorAll('table');
  for (var t = 0; t < tables.length; t++) {
    var firstRowText = (tables[t].rows[0] ? tables[t].rows[0].textContent : '').toLowerCase();
    if ((firstRowText.indexOf('tiết') >= 0 || firstRowText.indexOf('period') >= 0) &&
        (firstRowText.indexOf('thứ')  >= 0 || firstRowText.indexOf('monday') >= 0)) {
      schedTable = tables[t]; break;
    }
  }
  if (!schedTable) return [{ name: 'DEBUG: Không tìm thấy bảng lịch', dayOfWeek:1, periodStart:1, periodEnd:1, room:'', group:'', code:'', note:'' }];

  // ── 2. Map column index → dayOfWeek + actual date from page header ──────────
  var colDay  = {}; // colIdx → 0..6
  var colDate = {}; // colIdx → Date (actual date from header, e.g. 16/03/2026)
  var headerCells = schedTable.rows[0].cells;
  for (var c = 0; c < headerCells.length; c++) {
    var ht  = headerCells[c].textContent;
    var htl = ht.toLowerCase();
    if      (/monday|th.{0,3}2/i.test(htl))      colDay[c] = 1;
    else if (/tuesday|th.{0,3}3/i.test(htl))     colDay[c] = 2;
    else if (/wednesday|th.{0,3}4/i.test(htl))   colDay[c] = 3;
    else if (/thursday|th.{0,3}5/i.test(htl))    colDay[c] = 4;
    else if (/friday|th.{0,3}6/i.test(htl))      colDay[c] = 5;
    else if (/saturday|th.{0,3}7/i.test(htl))    colDay[c] = 6;
    else if (/sunday|ch.{1,5}nh.{1,3}t/i.test(htl)) colDay[c] = 0;
    // Extract actual date like "(17/03)" or "(17/03/2026)" from header
    var dm = ht.match(/\((\d{1,2})\/(\d{2})(?:\/(\d{4}))?\)/);
    if (dm && colDay[c] !== undefined) {
      var yr = dm[3] ? parseInt(dm[3]) : new Date().getFullYear();
      colDate[c] = new Date(yr, parseInt(dm[2]) - 1, parseInt(dm[1]));
    }
  }

  // ── 3. Build virtual grid with rowspan expansion ───────────────────────────
  // grid[r][c] = { text, rowspan, isOrigin }
  // isOrigin=true  → this is where the <td> physically is (we collect this)
  // isOrigin=false → occupied by a rowspan from above (SKIP)

  var ROWS = schedTable.rows.length;
  var COLS = headerCells.length;

  // sparse 2D array
  var grid = [];
  for (var i = 0; i < ROWS; i++) grid.push({});

  for (var r = 1; r < ROWS; r++) { // skip header row 0
    var physCells = schedTable.rows[r].cells;
    var physIdx = 0;
    for (var c2 = 0; c2 < COLS; c2++) {
      // If already filled by a rowspan from a previous row, skip
      if (grid[r][c2] !== undefined) continue;

      if (physIdx >= physCells.length) break;
      var cell = physCells[physIdx++];
      var rs = parseInt(cell.getAttribute('rowspan') || '1') || 1;
      var txt = cell.textContent.trim();

      // Place this cell as origin
      grid[r][c2] = { text: txt, rowspan: rs, isOrigin: true, element: cell };

      // Fill the rows below as "occupied" (not origin)
      for (var dr = 1; dr < rs; dr++) {
        if (r + dr < ROWS) {
          grid[r + dr][c2] = { text: txt, rowspan: rs, isOrigin: false };
        }
      }
    }
  }

  // ── 4. Build period-row mapping: rowIndex → periodNumber ──────────────────
  // Column 0 contains period numbers (1,2,...,16)
  var rowToPeriod = {};
  for (var r2 = 1; r2 < ROWS; r2++) {
    var cell0 = grid[r2][0];
    if (cell0 && cell0.isOrigin) {
      var pNum = parseInt(cell0.text);
      if (!isNaN(pNum) && pNum >= 1 && pNum <= 16) {
        rowToPeriod[r2] = pNum;
      }
    }
  }

  // ── 5. Parse a class cell text ─────────────────────────────────────────────
  function parseClassCell(text, dayOfWeek, periodStart, rowspan) {
    text = text.replace(/\s+/g, ' ').trim();
    if (!text || text.length < 3) return null;

    // Skip pure period-number cells (col 0)
    if (/^\d{1,2}$/.test(text)) return null;

    // Name: text before first "|" (Vietnamese name)
    var parts = text.split('|');
    var namePart = parts[0].trim();
    // Remove trailing code pattern like "(501044..."
    namePart = namePart.replace(/\s*\(\d{5,7}.*/, '').trim();
    if (!namePart || namePart.length < 2) return null;

    // English name (after first |, before next | or "(")
    var engName = '';
    if (parts.length > 1) {
      engName = parts[1].replace(/\(.*/, '').trim();
    }

    // Code: 5-7 digit number in parentheses
    var codeM = text.match(/\((\d{5,7})\s*[-–]/);
    var code = codeM ? codeM[1] : '';

    // Room
    // (lookahead GV: ghi chú "GV báo vắng" có thể dính liền sau tên phòng)
    var roomM = text.match(/Ph[oò]ng\|Room:\s*([^\s|)]+?)(?=GV|\s|\||\)|$)/i)
             || text.match(/Room:\s*([^\s|)]+?)(?=GV|\s|\||\)|$)/i);
    var room = roomM ? roomM[1].trim() : '';

    // Group (Nhóm) + Sub-group (Tổ)
    var nhomM = text.match(/Nh[oó]m\|Groups:\s*(\d+)/i);
    var toM   = text.match(/T[oổ]\|Sub-group:\s*(\d+)/i);
    var group = '';
    if (nhomM) group = 'Nhóm ' + nhomM[1];
    if (toM)   group += (group ? ' - ' : '') + 'Tổ ' + toM[1];

    // Note (so khớp không dấu: "GV báo vắng" / "GV dạy bù")
    var plain = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
    var absent = /gv\s+bao\s+vang/.test(plain);
    var note = '';
    if (absent)                          note = 'GV báo vắng';
    if (/gv\s+day\s+bu/.test(plain))     note = 'GV dạy bù';

    var periodEnd = periodStart + rowspan - 1;

    return {
      name:        namePart,
      engName:     engName,
      code:        code,
      dayOfWeek:   dayOfWeek,
      periodStart: periodStart,
      periodEnd:   periodEnd,
      room:        room,
      group:       group,
      note:        note,
      absent:      absent
    };
  }

  // ── 6. Walk grid, collect ONLY origin cells in day columns ─────────────────
  var results = [];

  for (var r3 = 1; r3 < ROWS; r3++) {
    var period = rowToPeriod[r3];
    if (period === undefined) continue; // row has no period label → skip

    for (var c3 = 1; c3 < COLS; c3++) { // skip col 0 (period labels)
      var day = colDay[c3];
      if (day === undefined) continue; // column not mapped to a day

      var cell3 = grid[r3][c3];
      if (!cell3) continue;
      if (!cell3.isOrigin) continue; // occupied by rowspan from above → SKIP

      var exactDate = colDate[c3] ? colDate[c3].getTime() : null;
      var parsed = parseClassCell(cell3.text, day, period, cell3.rowspan);
      if (parsed) parsed.exactDate = exactDate;
      if (parsed) results.push(parsed);
    }
  }

  return results;
}

// ─── Export ICS ───────────────────────────────────────────────────────────────
exportICS.addEventListener('click', function() {
  if (!visibleData().length) return;
  downloadFile('tdtu-lichhoc.ics', generateICS(visibleData()), 'text/calendar;charset=utf-8');
  setStatus('success', 'Đã xuất .ics — import vào Google Calendar nhé!');
});

function generateICS(data) {
  var PT = {
     1:{s:'0650',e:'0740'}, 2:{s:'0740',e:'0830'}, 3:{s:'0830',e:'0920'},
     4:{s:'0930',e:'1020'}, 5:{s:'1020',e:'1110'}, 6:{s:'1110',e:'1200'},
     7:{s:'1245',e:'1335'}, 8:{s:'1335',e:'1425'}, 9:{s:'1425',e:'1515'},
    10:{s:'1525',e:'1615'},11:{s:'1615',e:'1705'},12:{s:'1705',e:'1755'},
    13:{s:'1805',e:'1855'},14:{s:'1855',e:'1945'},15:{s:'1945',e:'2035'},
    16:{s:'2035',e:'2125'}
  };

  function fmtDT(date, hhmm) {
    var y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0');
    return y+m+d+'T'+hhmm+'00';
  }

  var lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TDTU Schedule Exporter//VI',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Lich hoc TDTU','X-WR-TIMEZONE:Asia/Ho_Chi_Minh'];

  data.forEach(function(cls, i) {
    // Use the exact date scraped from the page header
    var base = cls.exactDate ? new Date(cls.exactDate) : null;
    if (!base) {
      // Fallback: find the date of this day in current week (no shift)
      var today = new Date();
      var todayDow = today.getDay(); // 0=Sun
      var diff = cls.dayOfWeek - todayDow; // can be negative (earlier this week)
      base = new Date(today);
      base.setDate(today.getDate() + diff);
    }

    var ts = (PT[cls.periodStart] || PT[1]).s;
    var te = (PT[cls.periodEnd]   || PT[cls.periodStart] || PT[1]).e;

    var desc = buildDescription(cls);
    var col  = colorForClass(cls);

    // Single occurrence — NO RRULE
    lines.push('BEGIN:VEVENT',
      'UID:tdtu-'+i+'-'+Date.now()+'@tdtu.edu.vn',
      'DTSTART;TZID=Asia/Ho_Chi_Minh:'+fmtDT(base,ts),
      'DTEND;TZID=Asia/Ho_Chi_Minh:'+fmtDT(base,te),
      'SUMMARY:'+cls.name
    );
    if (cls.room) lines.push('LOCATION:'+cls.room);
    if (desc)     lines.push('DESCRIPTION:'+desc);
    // Google Calendar bỏ qua COLOR khi import .ics (chỉ app khác dùng);
    // muốn có màu trên Google → dùng nút "Đồng bộ Google Calendar".
    lines.push('COLOR:'+col.css);
    lines.push('STATUS:CONFIRMED','END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// ─── Đồng bộ Google Calendar (có màu) ─────────────────────────────────────────
// Chạy trong background.js vì popup sẽ tự đóng khi cửa sổ đăng nhập Google mở ra.
const syncGoogleBtn = document.getElementById('syncGoogle');

// Khoảng tuần (Thứ 2 → Thứ 2 kế tiếp, 'YYYY-MM-DD') phủ toàn bộ lớp đã đọc,
// KỂ CẢ lớp bị ẩn — để dọn được các sự kiện cũ của lớp vừa bị ẩn / báo vắng
function weekRange(all) {
  var t = all.map(function(c) { return classBaseDate(c).getTime(); });
  var lo = new Date(Math.min.apply(null, t)), hi = new Date(Math.max.apply(null, t));
  lo.setDate(lo.getDate() - ((lo.getDay() + 6) % 7));        // về Thứ 2
  hi.setDate(hi.getDate() - ((hi.getDay() + 6) % 7) + 7);    // Thứ 2 tuần kế tiếp
  return { from: localDateTime(lo, '00:00').slice(0, 10), to: localDateTime(hi, '00:00').slice(0, 10) };
}

function buildGoogleEvents(data) {
  return data.map(function(cls) {
    var base = classBaseDate(cls);
    var ts = (PERIOD_TIMES[cls.periodStart] || PERIOD_TIMES[1]).s;
    var te = (PERIOD_TIMES[cls.periodEnd] || PERIOD_TIMES[cls.periodStart] || PERIOD_TIMES[1]).e;
    var start = localDateTime(base, ts), end = localDateTime(base, te);
    return {
      // key ổn định → chạy lại sẽ CẬP NHẬT sự kiện cũ thay vì tạo trùng
      key: [cls.code, cls.name, cls.group, start, end].join('|'),
      body: {
        summary: cls.name,
        location: cls.room || undefined,
        description: buildDescription(cls) || undefined,
        start: { dateTime: start, timeZone: 'Asia/Ho_Chi_Minh' },
        end:   { dateTime: end,   timeZone: 'Asia/Ho_Chi_Minh' },
        colorId: colorForClass(cls).id
      }
    };
  });
}

syncGoogleBtn.addEventListener('click', function() {
  if (!scheduleData.length) return;
  if (!SETTINGS.clientId) {
    setStatus('error', 'Chưa nhập Google Client ID — bấm ⚙️ để mở Settings');
    return;
  }
  setStatus('loading', 'Đang mở đăng nhập Google... (nếu popup đóng, mở lại để xem kết quả)');
  chrome.runtime.sendMessage({
    type: 'syncGoogle',
    events: buildGoogleEvents(visibleData()),
    range: weekRange(scheduleData)
  });
  // Không chờ phản hồi: tiến trình/kết quả được lưu ở chrome.storage (syncStatus)
});

function showSyncStatus(s) {
  if (!s) return;
  setStatus(s.state === 'running' ? 'loading' : s.state === 'done' ? 'success' : 'error', s.msg);
}
chrome.storage.onChanged.addListener(function(ch, area) {
  if (area !== 'local') return;
  if (ch.syncStatus) showSyncStatus(ch.syncStatus.newValue);
  if (ch.settings) loadSettings().then(function() { if (scheduleData.length) renderSchedule(scheduleData); });
});

// ─── Export CSV ───────────────────────────────────────────────────────────────
exportExcel.addEventListener('click', function() {
  if (!visibleData().length) return;
  downloadFile('tdtu-lichhoc.csv', '\uFEFF'+generateCSV(visibleData()), 'text/csv;charset=utf-8');
  setStatus('success', 'Đã xuất CSV — mở bằng Excel nhé!');
});

function generateCSV(data) {
  var days = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
  var PT = PERIOD_TIMES;
  var header = ['Tên môn học','Tên tiếng Anh','Mã môn','Thứ','Tiết bắt đầu','Tiết kết thúc','Giờ bắt đầu','Giờ kết thúc','Phòng','Nhóm','Ghi chú'];
  var rows = [header];
  data.forEach(function(c) {
    var ts = (PT[c.periodStart]||{s:'',e:''}).s;
    var te = (PT[c.periodEnd]  ||{s:'',e:''}).e;
    rows.push([
      c.name||'', c.engName||'', c.code||'',
      days[c.dayOfWeek]||'',
      c.periodStart||'', c.periodEnd||'',
      ts, te,
      c.room||'', c.group||'', c.note||''
    ]);
  });
  return rows.map(function(r){
    return r.map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(',');
  }).join('\n');
}

function downloadFile(name, content, mime) {
  var url = URL.createObjectURL(new Blob([content],{type:mime}));
  var a = document.createElement('a'); a.href=url; a.download=name; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function() {
  await loadSettings();
  document.getElementById('settingsBtn').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  var url = tabs[0] ? tabs[0].url : '';
  if      (isOnSchedule(url)) setStatus('idle', 'Sẵn sàng — nhấn để tải lịch học');
  else if (isOnPortal(url))   setStatus('idle', 'Vào mục Thời khoá biểu, rồi nhấn lấy lịch');
  else                        setStatus('idle', 'Mở trang lịch học TDTU trước');

  // Không lưu cache lịch học: xoá bản cache cũ (nếu còn từ phiên bản trước)
  chrome.storage.local.remove('scheduleData');
})();
