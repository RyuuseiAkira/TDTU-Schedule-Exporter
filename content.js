// content.js — injected into stdportal.tdtu.edu.vn AND lichhoc-lichthi.tdtu.edu.vn
// Listens for messages from popup to assist with schedule extraction

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ ok: true, url: window.location.href });
  }
  if (request.action === 'getSchedule') {
    sendResponse({ data: scrapeScheduleFromPage() });
  }
  return true;
});

function scrapeScheduleFromPage() {
  const results = [];
  const tables = document.querySelectorAll('table');

  for (const table of tables) {
    const rows = [...table.querySelectorAll('tr')];
    if (rows.length < 2) continue;

    const headers = [...rows[0].querySelectorAll('th, td')]
      .map(td => td.textContent.trim().toLowerCase());

    const isSchedule = headers.some(h =>
      h.includes('học phần') || h.includes('môn học') ||
      h.includes('tên môn')  || h.includes('tiết')
    );

    if (!isSchedule) continue;

    const hIdx = {
      name:    headers.findIndex(h => h.includes('học phần') || h.includes('môn') || h.includes('tên')),
      code:    headers.findIndex(h => h.includes('mã')),
      day:     headers.findIndex(h => h.includes('thứ')),
      period:  headers.findIndex(h => h.includes('tiết')),
      room:    headers.findIndex(h => h.includes('phòng')),
      teacher: headers.findIndex(h => h.includes('giảng') || h.includes('gv')),
      group:   headers.findIndex(h => h.includes('nhóm') || h.includes('lớp'))
    };

    for (let i = 1; i < rows.length; i++) {
      const cells = [...rows[i].querySelectorAll('td')].map(td => td.textContent.trim());
      if (!cells.length || !cells[hIdx.name >= 0 ? hIdx.name : 0]) continue;

      const name = cells[hIdx.name >= 0 ? hIdx.name : 0];

      let dayOfWeek = 1;
      if (hIdx.day >= 0 && cells[hIdx.day]) {
        const d = cells[hIdx.day];
        if (/cn|chủ|sun/i.test(d))    dayOfWeek = 0;
        else if (/2|hai/i.test(d))    dayOfWeek = 1;
        else if (/3|ba/i.test(d))     dayOfWeek = 2;
        else if (/4|tư/i.test(d))     dayOfWeek = 3;
        else if (/5|năm/i.test(d))    dayOfWeek = 4;
        else if (/6|sáu/i.test(d))    dayOfWeek = 5;
        else if (/7|bảy/i.test(d))    dayOfWeek = 6;
        else { const n = parseInt(d); if (!isNaN(n)) dayOfWeek = n % 7; }
      }

      let ps = 1, pe = 3;
      if (hIdx.period >= 0 && cells[hIdx.period]) {
        const m = cells[hIdx.period].match(/(\d+)\s*[-–,]\s*(\d+)/);
        if (m) { ps = +m[1]; pe = +m[2]; }
        else { const n = parseInt(cells[hIdx.period]); if (!isNaN(n)) { ps = n; pe = n + 2; } }
      }

      results.push({
        name, dayOfWeek, periodStart: ps, periodEnd: pe,
        code:    hIdx.code    >= 0 ? (cells[hIdx.code]    || '') : '',
        room:    hIdx.room    >= 0 ? (cells[hIdx.room]    || '') : '',
        teacher: hIdx.teacher >= 0 ? (cells[hIdx.teacher] || '') : '',
        group:   hIdx.group   >= 0 ? (cells[hIdx.group]   || '') : ''
      });
    }
  }

  return results;
}
