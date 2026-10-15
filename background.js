// background.js — service worker for TDTU Schedule Exporter
importScripts('config.js', 'shared.js');

chrome.runtime.onInstalled.addListener(() => {
  console.log('TDTU Schedule Exporter installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'keepAlive') { sendResponse({ ok: true }); return true; }
  if (message.type === 'syncGoogle') {
    syncToGoogle(message.events).catch(err => setSync('error', 'Lỗi: ' + err.message, true));
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
  return res.json();
}

async function syncToGoogle(events) {
  await loadSettings();
  if (!SETTINGS.clientId) throw new Error('Chưa nhập Google Client ID — mở ⚙️ Settings');
  if (!events || !events.length) throw new Error('Không có sự kiện để đồng bộ');

  setSync('running', 'Đang đăng nhập Google...');
  const token = await getToken();

  let created = 0, updated = 0;
  for (let i = 0; i < events.length; i++) {
    setSync('running', 'Đang đồng bộ ' + (i + 1) + '/' + events.length + '...');
    const id = await eventId(events[i].key);
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
  setSync('done', 'Xong ✓ Tạo mới ' + created + ', cập nhật ' + updated + ' sự kiện', true);
}
