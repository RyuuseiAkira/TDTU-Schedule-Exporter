// background.js — service worker for TDTU Schedule Exporter
// Bảo mật: chỉ nhận lệnh từ popup của chính extension; kiểm tra chặt mọi dữ liệu
// trước khi gửi lên Google; chỉ xoá đúng các sự kiện do extension tạo.
// Chrome/Edge: service worker → importScripts. Firefox: event page → các file nạp qua
// background.scripts trong manifest (importScripts không tồn tại).
if (typeof importScripts === 'function') importScripts('config.js', 'shared.js');

const TZ = 'Asia/Ho_Chi_Minh';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const MAX_EVENTS = 300;        // tối đa số sự kiện / lần đồng bộ
const MAX_DELETE = 60;         // tối đa số sự kiện được phép xoá / lần
const MAX_RANGE_DAYS = 62;     // tối đa khoảng ngày được phép dọn
const OWN_ID_RE = /^tdtu[0-9a-f]{40}$/;   // id do extension sinh ra (xem eventId)
const CLIENT_ID_RE = /^[0-9A-Za-z._-]{5,120}\.apps\.googleusercontent\.com$/;
const CALENDAR_ID_RE = /^(primary|[A-Za-z0-9._%+@#-]{3,255})$/;

let syncing = false;           // khoá: không chạy 2 lần đồng bộ cùng lúc

ext.runtime.onInstalled.addListener(() => {
  console.log('TDTU Schedule Exporter installed');
});

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Chỉ chấp nhận tin nhắn từ popup.html của chính extension (content script, trang web
  // và extension khác có sender.url / sender.id khác nên bị bỏ qua).
  const popupUrl = ext.runtime.getURL('popup.html');
  if (sender.id !== ext.runtime.id || !sender.url || !sender.url.startsWith(popupUrl)) {
    return false;
  }
  if (message && message.type === 'syncGoogle') {
    if (syncing) { sendResponse({ started: false, reason: 'busy' }); return false; }
    syncing = true;
    syncToGoogle(message.events, message.range)
      .catch(err => setSync('error', 'Lỗi: ' + err.message, true))
      .finally(() => { syncing = false; });
    sendResponse({ started: true });
  }
  return false;
});

function setSync(state, msg, badge) {
  ext.storage.local.set({ syncStatus: { state, msg, ts: Date.now() } });
  if (badge) ext.action.setBadgeText({ text: state === 'done' ? '✓' : '!' });
}

// ── Kiểm tra dữ liệu nhận từ popup ──────────────────────────────────────────
const DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/;

// Dựng lại body từ danh sách trường được phép (không chuyển tiếp dữ liệu lạ)
function buildSafeBody(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw.start && raw.start.dateTime, e = raw.end && raw.end.dateTime;
  if (typeof s !== 'string' || typeof e !== 'string' || !DT_RE.test(s) || !DT_RE.test(e) || e <= s) return null;
  const colorId = String(raw.colorId);
  if (!/^(?:[1-9]|1[01])$/.test(colorId)) return null;
  const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const summary = clip(raw.summary, 200);
  if (!summary) return null;
  const body = { summary, start: { dateTime: s, timeZone: TZ }, end: { dateTime: e, timeZone: TZ }, colorId };
  const loc = clip(raw.location, 200);      if (loc)  body.location = loc;
  const desc = clip(raw.description, 1000); if (desc) body.description = desc;
  return body;
}

function validRange(r) {
  if (!r || typeof r.from !== 'string' || typeof r.to !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.from) || !/^\d{4}-\d{2}-\d{2}$/.test(r.to)) return null;
  const a = Date.parse(r.from + 'T00:00:00Z'), b = Date.parse(r.to + 'T00:00:00Z');
  if (!(b > a) || (b - a) / 864e5 > MAX_RANGE_DAYS) return null;
  return { from: r.from, to: r.to };
}

// ── Đăng nhập Google (OAuth implicit flow; chạy được trên Chrome và Edge) ─────
function randomState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
}

async function getToken() {
  const redirect = ext.identity.getRedirectURL();
  const state = randomState();                       // chống CSRF / phản hồi giả
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: SETTINGS.clientId,
    response_type: 'token',
    redirect_uri: redirect,
    scope: SCOPE,
    state
  });
  const res = await ext.identity.launchWebAuthFlow({ url, interactive: true });
  if (!res || !res.startsWith(redirect)) throw new Error('Phản hồi đăng nhập không hợp lệ');

  const params = new URLSearchParams(new URL(res).hash.replace(/^#/, ''));
  if (params.get('error')) throw new Error('Google từ chối: ' + params.get('error'));
  if (params.get('state') !== state) throw new Error('Phản hồi đăng nhập không khớp (state)');
  const token = params.get('access_token');
  if (!token) throw new Error('Không lấy được token đăng nhập Google');
  if ((params.get('token_type') || 'Bearer').toLowerCase() !== 'bearer') throw new Error('Loại token không hợp lệ');
  const granted = (params.get('scope') || '').split(/\s+/);
  if (!granted.includes(SCOPE)) throw new Error('Bạn chưa cấp quyền quản lý sự kiện lịch');
  return token;                                      // chỉ giữ trong biến cục bộ, không lưu
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

// Xoá các sự kiện DO EXTENSION TẠO (id đúng mẫu tdtu + 40 hex) trong khoảng tuần
// mà không còn nằm trong danh sách mới (lớp báo vắng / blacklist / đổi giờ).
// Sự kiện bạn tự tạo hoặc import từ .ics (id khác) không bao giờ bị đụng tới.
async function cleanupStale(token, keepIds, range) {
  const stale = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({
      timeMin: range.from + 'T00:00:00+07:00',
      timeMax: range.to + 'T00:00:00+07:00',
      singleEvents: 'true', maxResults: '250', fields: 'items(id),nextPageToken'
    });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await api(token, 'GET', '?' + q.toString());
    for (const ev of (res.items || [])) {
      if (ev && typeof ev.id === 'string' && OWN_ID_RE.test(ev.id) && !keepIds.has(ev.id)) stale.push(ev.id);
    }
    pageToken = res.nextPageToken || '';
  } while (pageToken);

  // Chốt an toàn: nếu số sự kiện cần xoá bất thường thì dừng, không xoá gì cả
  if (stale.length > MAX_DELETE) {
    throw new Error('Có ' + stale.length + ' sự kiện cần xoá (> ' + MAX_DELETE + '), đã dừng để an toàn. Kiểm tra lại lịch.');
  }
  let deleted = 0;
  for (const id of stale) {
    try { await api(token, 'DELETE', '/' + id); deleted++; }
    catch (err) { if (err.status !== 404 && err.status !== 410) throw err; }
  }
  return deleted;
}

async function syncToGoogle(rawEvents, rawRange) {
  await loadSettings();
  if (!CLIENT_ID_RE.test(SETTINGS.clientId || '')) throw new Error('Google Client ID chưa nhập hoặc sai định dạng — mở ⚙️ Settings');
  if (!CALENDAR_ID_RE.test(SETTINGS.calendarId || 'primary')) throw new Error('Calendar ID không hợp lệ — mở ⚙️ Settings');

  if (!Array.isArray(rawEvents)) throw new Error('Dữ liệu đồng bộ không hợp lệ');
  if (rawEvents.length > MAX_EVENTS) throw new Error('Quá nhiều sự kiện (' + rawEvents.length + ' > ' + MAX_EVENTS + ')');
  const range = rawRange == null ? null : validRange(rawRange);
  if (rawRange != null && !range) throw new Error('Khoảng ngày đồng bộ không hợp lệ');

  const events = [];
  for (const ev of rawEvents) {
    const body = buildSafeBody(ev && ev.body);
    if (!ev || typeof ev.key !== 'string' || ev.key.length > 600 || !body) throw new Error('Có sự kiện sai định dạng, đã dừng');
    events.push({ key: ev.key, body });
  }
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
