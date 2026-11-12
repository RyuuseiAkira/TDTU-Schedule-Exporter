// config.js — GIÁ TRỊ MẶC ĐỊNH (lần đầu cài đặt).
// Bạn không cần sửa file này: bấm ⚙️ trong popup (hoặc chuột phải icon → Options)
// để chỉnh màu, Client ID, Calendar ID ngay trong extension.
const DEFAULTS = {
  language: 'en',
  animateMascot: true,
  // mã môn → tên màu (tomato, flamingo, tangerine, banana, sage, basil,
  //                   peacock, blueberry, lavender, grape, graphite)
  subjectColors: {
    '501042': 'tomato',
    '502044': 'peacock',
    '302053': 'basil'
  },
  // tên môn (chỉ để hiển thị trong Settings)
  subjectNames: {
    '501042': 'Phương pháp lập trình',
    '502044': 'Tổ chức máy tính',
    '302053': 'Pháp luật đại cương'
  },
  // môn bị ẩn khỏi popup và mọi file xuất / đồng bộ.
  // match: mã môn (toàn số, khớp chính xác) hoặc từ khoá trong tên môn
  blacklist: [
    { match: '000000', name: 'Lịch học Tiếng Anh dự kiến' }
  ],
  ignoreAbsent: true,         // bỏ qua các lớp có "GV báo vắng"
  defaultColor: 'graphite',   // màu cho môn chưa khai báo
  clientId: '',               // Google OAuth Client ID
  calendarId: 'primary'       // 'primary' = lịch chính
};
