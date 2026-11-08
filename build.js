#!/usr/bin/env node
// build.js — tạo bản cài riêng cho từng trình duyệt (không cần cài thêm gì, chỉ cần Node.js).
//
//   node build.js            → dist/chrome và dist/firefox
//   node build.js firefox    → chỉ dist/firefox
//   node build.js chrome     → chỉ dist/chrome
//
// Chrome / Edge: có thể nạp thẳng thư mục gốc (Load unpacked), không cần build.
// Firefox: nạp dist/firefox/manifest.json (about:debugging → Load Temporary Add-on).
//
// Vì sao phải tách? Manifest của Chrome và Firefox khác nhau ở phần chạy nền:
//   Chrome:  "background": { "service_worker": "background.js" }
//   Firefox: "background": { "scripts": [...] }   (Chrome báo lỗi nếu thấy khoá này)

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

// ⚠️ Đổi thành ID riêng của bạn (dạng email bất kỳ) TRƯỚC khi đăng ký Redirect URI trong
// Google Cloud: Redirect URI trên Firefox được tính từ ID này, đổi ID là URI đổi theo.
const GECKO_ID = 'tdtu-schedule-exporter@example.com';

// Danh sách trắng: chỉ các file này mới được đóng gói (không bao giờ lẫn file .ics / .html cá nhân).
// Thêm file nguồn mới thì nhớ thêm vào đây.
const FILES = ['background.js', 'config.js', 'options.html', 'options.js',
               'popup.html', 'popup.js', 'shared.js', 'icons', 'LICENSE'];

const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

const targets = {
  chrome: (m) => m,
  firefox: (m) => {
    const f = JSON.parse(JSON.stringify(m));
    delete f.minimum_chrome_version;
    f.background = { scripts: ['config.js', 'shared.js', 'background.js'] };   // event page
    f.browser_specific_settings = {
      gecko: {
        id: GECKO_ID,
        strict_min_version: '140.0',
        data_collection_permissions: { required: ['websiteContent'] }
      },
      gecko_android: { strict_min_version: '142.0' }
    };
    return f;
  }
};

// Kiểm tra mọi file mà manifest tham chiếu đều có mặt trong gói
function verify(out, manifest) {
  const refs = [];
  (manifest.background.scripts || []).forEach((s) => refs.push(s));
  if (manifest.background.service_worker) refs.push(manifest.background.service_worker);
  if (manifest.action && manifest.action.default_popup) refs.push(manifest.action.default_popup);
  if (manifest.options_ui && manifest.options_ui.page) refs.push(manifest.options_ui.page);
  Object.values(manifest.icons || {}).forEach((i) => refs.push(i));
  const missing = refs.filter((r) => !fs.existsSync(path.join(out, r)));
  if (missing.length) throw new Error('Thiếu file trong gói: ' + missing.join(', '));
}

function build(name) {
  const out = path.join(DIST, name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const f of FILES) fs.cpSync(path.join(ROOT, f), path.join(out, f), { recursive: true });
  const manifest = targets[name](base);
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  verify(out, manifest);
  console.log('✓ dist/' + name);
}

const arg = process.argv[2] || 'all';
const names = arg === 'all' ? Object.keys(targets) : [arg];
for (const n of names) {
  if (!targets[n]) { console.error('Dùng: node build.js [chrome|firefox|all]'); process.exit(1); }
  build(n);
}
