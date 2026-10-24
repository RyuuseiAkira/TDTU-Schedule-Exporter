// background.js — service worker for TDTU Schedule Exporter
importScripts('config.js', 'shared.js');

chrome.runtime.onInstalled.addListener(() => {
  console.log('TDTU Schedule Exporter installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'keepAlive') { sendResponse({ ok: true }); return true; }
  if (message.type === 'syncGoogle') {
    syncToGoogle(message.events, message.range).catch(err => setSync('error', 'Lỗi: ' + err.message, true));
    sendResponse({ started: true });
    return true;
  }
  return true;
});

function setSync(state, msg, badge) {
  chrome.storage.local.set({ syncStatus: { state, msg, ts: Date.now() } });
  if (badge) chrome.action.setBadgeText({ text: state === 'done' ? '✓' : '!' });
}

// Đăng nhập Google (OAuth implicit flow, chạy được trên cả Chrome và Edge)
async function getToken() {
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: SETTINGS.clientId,
    response_type: 'token',
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: 'https://www.googleapis.com/auth/calendar.events'
  });
  const res = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  const m = res && res.match(/[#&]access_token=([^&]+)/);
  if (!m) throw new Error('Không lấy được token đăng nhập Google');
  return decodeURIComponent(m[1]);
}

// Google yêu cầu event id: chữ thường a-v và số, 5–1024 ký tự → dùng hex của SHA-1
async function eventId(key) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode('tdtu|' + key));
  return 'tdtu' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function api(token, method, path, body) {
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/' +
    encodeURIComponent(SETTINGS.calendarId || 'primary') + '/events' + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).error.message; } catch (e) {}
    const err = new Error('HTTP ' + res.status + (detail ? ' – ' + detail : ''));
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;   // DELETE thành công, không có nội dung
  return res.json();
}

// Xoá các sự kiện DO EXTENSION TẠO (id bắt đầu bằng 'tdtu') trong khoảng tuần
// mà không còn nằm trong danh sách mới (lớp báo vắng / blacklist / đổi giờ).
// Sự kiện bạn tự tạo hoặc import từ .ics (id khác) không bao giờ bị đụng tới.
async function cleanupStale(token, keepIds, range) {
  let deleted = 0, pageToken = '';
  do {
    const q = new URLSearchParams({
      timeMin: range.from + 'T00:00:00+07:00',
      timeMax: range.to + 'T00:00:00+07:00',
      singleEvents: 'true', maxResults: '250', fields: 'items(id),nextPageToken'
    });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await api(token, 'GET', '?' + q.toString());
    for (const ev of (res.items || [])) {
      if (!ev.id || !ev.id.startsWith('tdtu') || keepIds.has(ev.id)) continue;
      try { await api(token, 'DELETE', '/' + ev.id); deleted++; }
      catch (err) { if (err.status !== 404 && err.status !== 410) throw err; }
    }
    pageToken = res.nextPageToken || '';
  } while (pageToken);
  return deleted;
}

async function syncToGoogle(events, range) {
  await loadSettings();
  if (!SETTINGS.clientId) throw new Error('Chưa nhập Google Client ID — mở ⚙️ Settings');
  events = events || [];
  if (!events.length && !range) throw new Error('Không có sự kiện để đồng bộ');

  setSync('running', 'Đang đăng nhập Google...');
  const token = await getToken();

  let created = 0, updated = 0, deleted = 0;
  const keepIds = new Set();
  for (let i = 0; i < events.length; i++) {
    setSync('running', 'Đang đồng bộ ' + (i + 1) + '/' + events.length + '...');
    const id = await eventId(events[i].key);
    keepIds.add(id);
    const body = Object.assign({ id }, events[i].body);
    try {
      await api(token, 'POST', '', body);
      created++;
    } catch (err) {
      if (err.status !== 409) throw err;
      // Đã tồn tại (hoặc từng bị xoá) → ghi đè để cập nhật màu/phòng/giờ
      body.status = 'confirmed';
      await api(token, 'PUT', '/' + id, body);
      updated++;
    }
  }
  if (range) {
    setSync('running', 'Đang dọn sự kiện cũ...');
    deleted = await cleanupStale(token, keepIds, range);
  }
  setSync('done', 'Xong ✓ Tạo mới ' + created + ', cập nhật ' + updated + ', xoá ' + deleted + ' sự kiện', true);
}
