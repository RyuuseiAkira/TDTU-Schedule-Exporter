# TDTU Schedule Exporter

[English](README.md) · **Tiếng Việt**

Extension cho Chrome, Edge và Firefox giúp lấy **thời khoá biểu** từ trang lịch học của Đại học Tôn Đức Thắng (TDTU) và:

- xuất file **.ics** (Google Calendar, Outlook, Apple Calendar...)
- xuất file **Excel / CSV**
- **đồng bộ thẳng lên Google Calendar, mỗi môn một màu** riêng

> [!NOTE]
> Đây là dự án cá nhân, **không liên kết với TDTU**. Dựa trên [MinhQuan06/TDTU-extensions](https://github.com/MinhQuan06/TDTU-extensions).

## Tính năng

| Tính năng | Mô tả |
|---|---|
| Lấy lịch theo tuần | Đọc bảng thời khoá biểu đang mở, ra đúng ngày thật của từng buổi học |
| Màu theo môn | Gán màu theo **mã môn**, tuỳ chỉnh ngay trong Settings |
| Đồng bộ Google Calendar | Tạo / cập nhật sự kiện qua API, chạy lại nhiều lần **không bị trùng**, bỏ qua sự kiện không thay đổi và tự xoá sự kiện cũ không còn hiệu lực |
| Cảnh báo trùng lịch | Phát hiện các lớp trùng giờ trong cùng ngày (kể cả lớp nằm chung một ô bảng) và hiển thị cảnh báo, vẫn xuất đầy đủ cả hai |
| Blacklist | Ẩn môn theo mã môn hoặc từ khoá tên (mặc định ẩn `000000` - Lịch học Tiếng Anh dự kiến) |
| Bỏ qua "GV báo vắng" | Công tắc trong Settings; lớp báo vắng không bị xuất / đồng bộ |
| Không lưu cache | Mỗi lần mở popup đều đọc lại lịch hiện tại từ trang TDTU |

Mô tả sự kiện có dạng: `Nhóm 5 | Mã: 501042 | Programming Methodology`

---

## Cài đặt

### Chrome / Edge

1. Tải code: `git clone https://github.com/RyuuseiAkira/TDTU-Schedule-Exporter.git` hoặc **Code -> Download ZIP** rồi giải nén.
2. Mở `chrome://extensions` (Edge: `edge://extensions`).
3. Bật **Developer mode** (góc trên bên phải).
4. Bấm **Load unpacked** -> chọn thư mục gốc của project (thư mục có file `manifest.json`).

> [!TIP]
> Sau khi sửa code hoặc `config.js`, bấm nút **Reload** trên thẻ extension.

### Firefox (140+)

Firefox dùng background script thay vì service worker nên cần tạo gói riêng bằng Node.js:

1. Chạy lệnh `node build.js firefox` trong thư mục project (chỉ cần Node.js, không cần cài thêm thư viện). Lệnh này tạo ra thư mục `dist/firefox/`.
2. Mở `about:debugging#/runtime/this-firefox`.
3. Bấm **Load Temporary Add-on...** và chọn file `dist/firefox/manifest.json`.

> [!IMPORTANT]
> Nếu bạn dùng tính năng đồng bộ Google Calendar trên Firefox, hãy đổi `GECKO_ID` trong `build.js` sang ID riêng của bạn (ví dụ `yourname-tdtu@example.com`) **trước khi** build và đăng ký Redirect URI trên Google Cloud.

## Sử dụng

1. Đăng nhập [stdportal.tdtu.edu.vn](https://stdportal.tdtu.edu.vn), vào trang **Thời khoá biểu** (bảng lịch theo tuần).
2. Bấm icon extension -> **Lấy lịch học**.
3. Chọn một trong các cách xuất:
   - **Xuất .ics** -> import vào lịch (Google Calendar **không giữ màu** từ file .ics).
   - **Xuất Excel** -> tải file CSV chuẩn UTF-8 mở trực tiếp bằng Excel.
   - **Đồng bộ Google Calendar (có màu)** -> cần cài đặt API một lần, xem bên dưới.

Extension chỉ đọc **tuần đang hiển thị** trên trang. Muốn xuất tuần khác, chuyển tuần trên trang TDTU rồi bấm **Lấy lịch học** lại.

---

## Settings

Bấm nút bánh răng trong popup (hoặc chuột phải icon extension -> *Options*). Mọi thay đổi **tự lưu**.

- **Màu theo môn học**: mỗi dòng là một mã môn + màu. Bấm chấm tròn để chọn màu, nút chặn để chuyển môn vào blacklist, nút thùng rác để xoá.
  Môn chưa khai báo dùng **màu mặc định**. Popup có nút **Thêm vào Settings** để tự gán màu cho các môn mới.
- **Lớp học**: công tắc *Bỏ qua các lớp có "GV báo vắng"* (mặc định bật).
- **Blacklist**: nhập **mã môn** (toàn số, khớp chính xác, vd `000000`) hoặc **từ khoá** trong tên môn (vd `tiếng anh`, không phân biệt hoa thường). Từ khoá ngắn có thể ẩn nhầm môn khác.
- **Google Calendar**: Client ID và Calendar ID (xem hướng dẫn bên dưới).
- **Khôi phục mặc định**.

Google chỉ cho **11 màu** cho sự kiện: Lavender, Sage, Grape, Flamingo, Banana, Tangerine, Peacock, Graphite, Blueberry, Basil, Tomato. Không dùng được mã hex tuỳ ý.

Giá trị mặc định ban đầu nằm trong `config.js` (bạn không cần sửa file này nếu dùng Settings).

---

## Cài đặt Google Calendar API (làm 1 lần, miễn phí, ~10 phút)

### Vì sao cần bước này?

Khi import file `.ics`, Google Calendar **bỏ qua màu** của từng sự kiện. Cách duy nhất để mỗi môn một màu là tạo sự kiện qua **Google Calendar API** (trường `colorId`). API cần một **OAuth Client ID** do chính bạn tạo, để extension xin quyền thêm sự kiện vào lịch của bạn.

- Không cần thẻ thanh toán, Google Calendar API miễn phí.
- **Client ID không phải bí mật** (không có "client secret" trong extension này), nhưng vẫn nên dùng Client ID của riêng bạn thay vì chia sẻ.
- Extension chỉ xin quyền `calendar.events` (tạo / sửa / xoá sự kiện), không đọc email, danh bạ hay thứ gì khác.

> [!NOTE]
> Giao diện Google Cloud Console thay đổi thường xuyên; tên menu bên dưới có thể hơi khác (ví dụ mục *OAuth consent screen* nay nằm trong **Google Auth Platform**). Hãy bám theo ý nghĩa từng bước.

### Bước 1 - Lấy Redirect URI của extension

1. Load extension (xem phần Cài đặt).
2. Mở **Settings** -> mục **Google Calendar** -> ô **Redirect URI**:
   - Trên Chrome / Edge: `https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/`
   - Trên Firefox: `https://<hash>.extensions.allizom.org/`
3. Bấm **Copy** (sẽ dùng ở Bước 5). Nếu dùng cả hai trình duyệt, hãy thêm cả hai URI ở Bước 5.

> [!WARNING]
> Trên Chrome/Edge, phần `abcdef...` là **ID của extension**, phụ thuộc vào đường dẫn thư mục khi *Load unpacked*. Nếu bạn **di chuyển / đổi tên thư mục** hoặc cài lại ở chỗ khác, ID đổi -> phải cập nhật lại Redirect URI trong Google Cloud (Bước 5).

### Bước 2 - Tạo project trên Google Cloud

1. Vào <https://console.cloud.google.com> và đăng nhập bằng tài khoản Google bạn dùng cho lịch.
2. Bấm thanh chọn project ở đầu trang -> **New project** -> đặt tên (vd `TDTU Calendar`) -> **Create**.
3. Đảm bảo project vừa tạo đang được chọn.

### Bước 3 - Bật Google Calendar API

1. Mở menu điều hướng -> **APIs & Services** -> **Library**.
2. Tìm **Google Calendar API** -> **Enable**.

### Bước 4 - Cấu hình màn hình đồng ý (OAuth consent screen)

1. Menu điều hướng -> **APIs & Services** -> **OAuth consent screen** (hoặc **Google Auth Platform**).
2. Nếu được hỏi, bấm **Get started** và điền:
   - **App name**: tuỳ ý (vd `TDTU Schedule Exporter`)
   - **User support email** và **Developer contact email**: email của bạn
3. **Audience / User type**: chọn **External**.
4. Ở mục **Test users** (Audience -> Test users) -> **Add users** -> thêm **chính email Google bạn sẽ dùng để đồng bộ** -> **Save**.
   - Để app ở trạng thái **Testing** là được, **không cần** gửi xét duyệt (verification) vì chỉ bạn dùng.
5. *(Nếu có mục Data access / Scopes)* thêm scope `https://www.googleapis.com/auth/calendar.events`. Nếu bỏ qua, Google vẫn hiện scope này lúc bạn đồng ý đăng nhập.

### Bước 5 - Tạo OAuth Client ID

1. **APIs & Services** -> **Credentials** (hoặc **Google Auth Platform -> Clients**) -> **Create credentials / Create client** -> **OAuth client ID**.
2. **Application type**: chọn **Web application** (không chọn "Chrome extension").
3. **Name**: tuỳ ý.
4. **Authorized redirect URIs** -> **Add URI** -> dán Redirect URI đã copy ở Bước 1 (đúng từng ký tự, có dấu `/` ở cuối).
5. **Create**. Google hiện hộp thoại chứa **Client ID** dạng `123456789-abcdefg.apps.googleusercontent.com` -> copy lại.
   *(Bỏ qua "Client secret", extension không dùng.)*

> [!NOTE]
> Một số tài khoản mất vài phút để cấu hình mới có hiệu lực. Nếu báo lỗi ngay, chờ 5 phút rồi thử lại.

### Bước 6 - Dán Client ID vào extension

Mở **Settings** -> **Google Calendar** -> dán vào ô **Google OAuth Client ID**. (Tự lưu.)

### Bước 7 - (Khuyến nghị) Tạo lịch riêng cho TDTU

Dùng lịch riêng giúp bạn xoá sạch lịch học khi hết học kỳ chỉ bằng một thao tác.

1. Mở [calendar.google.com](https://calendar.google.com) trên máy tính.
2. Cạnh **Other calendars** bấm **+** -> **Create new calendar** -> đặt tên (vd `TDTU Schedule`) -> **Create calendar**.
3. Di chuột vào lịch vừa tạo -> **Options** -> **Settings and sharing** -> kéo xuống **Integrate calendar** -> copy **Calendar ID** (dạng `abc123@group.calendar.google.com`).
4. Dán vào ô **Calendar ID** trong Settings của extension.

Để `primary` nếu muốn dùng lịch chính. Lịch phải thuộc tài khoản bạn đăng nhập (hoặc được chia sẻ với quyền chỉnh sửa).

### Bước 8 - Đồng bộ lần đầu

1. Mở trang thời khoá biểu -> bấm **Lấy lịch học** -> **Đồng bộ Google Calendar (có màu)**.
2. Một cửa sổ đăng nhập Google hiện ra -> chọn tài khoản đã thêm làm Test user.
3. Google cảnh báo **"Google hasn't verified this app"** (vì đây là app của chính bạn) -> **Advanced** -> **Go to ... (unsafe)** -> **Continue / Allow**.
4. Popup có thể tự đóng khi cửa sổ đăng nhập mở. Đây là bình thường. Quá trình chạy nền; icon extension hiện thông báo khi xong, mở lại popup để xem kết quả.

Chạy đồng bộ lại bất cứ lúc nào: sự kiện cũ được **cập nhật** (đổi phòng, giờ, màu...) hoặc giữ nguyên nếu không đổi thay vì tạo trùng.

> [!WARNING]
> Nếu trước đó đã import `.ics` vào cùng lịch, hãy **xoá các sự kiện cũ** đó (hoặc dùng lịch mới ở Bước 7) để khỏi bị trùng.

> [!NOTE]
> **Tự dọn lịch:** mỗi lần đồng bộ, extension xoá khỏi tuần đó các sự kiện **do chính nó tạo** mà không còn trong danh sách mới (lớp vừa bị "GV báo vắng", vừa bị blacklist, hoặc đổi giờ). Sự kiện bạn tự tạo hoặc import từ `.ics` **không bao giờ bị xoá**. Chỉ dọn trong các tuần có trong trang đang đọc, các tuần khác giữ nguyên.

### Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân & cách xử lý |
|---|---|
| `Error 400: redirect_uri_mismatch` | Redirect URI trong Google Cloud khác với trong Settings. Copy lại từ Settings, dán đúng từng ký tự (kể cả `/` cuối). Nếu vừa di chuyển thư mục extension, ID đã đổi. |
| `Error 403: access_denied` / "app has not completed verification" | Email đang đăng nhập chưa nằm trong **Test users** (Bước 4). |
| `HTTP 403 - Google Calendar API has not been used...` | Chưa **Enable** Google Calendar API trong đúng project đã tạo Client ID (Bước 3). Đợi vài phút sau khi bật. |
| `HTTP 404 - Not Found` | **Calendar ID** sai hoặc lịch không thuộc tài khoản này. Thử để `primary`. |
| `HTTP 401` | Token hết hạn / bị từ chối, bấm đồng bộ lại để đăng nhập mới. |
| `Chưa nhập Google Client ID` | Chưa dán Client ID vào Settings (Bước 6). |
| `Không lấy được token đăng nhập Google` | Bạn đóng cửa sổ đăng nhập giữa chừng, hoặc loại Client ID không phải **Web application**. |
| Sự kiện không có màu | Môn chưa có trong danh sách màu, đang dùng màu mặc định (Graphite). Thêm trong Settings. |
| Mã `000000` / lớp tiếng Anh không xuất hiện | Nó nằm trong Blacklist mặc định, xoá dòng đó trong Settings nếu muốn xuất. |

---

## Quyền riêng tư & bảo mật

- Extension chạy **hoàn toàn trong trình duyệt của bạn**; không có server riêng, không thu thập hay gửi dữ liệu đi đâu ngoài **Google Calendar API** (khi bạn bấm đồng bộ).
- Quyền (permissions) sử dụng:
  - `activeTab`, `scripting` + trang `stdportal.tdtu.edu.vn`, `lichhoc-lichthi.tdtu.edu.vn`: đọc bảng thời khoá biểu bạn đang mở.
  - `storage`: lưu Settings (màu, blacklist, Client ID, Calendar ID) trong `storage.local` của trình duyệt.
  - `identity` + `https://www.googleapis.com/*`: đăng nhập Google và gọi Calendar API.
- Scope OAuth: chỉ `https://www.googleapis.com/auth/calendar.events` (tạo / sửa / xoá sự kiện; extension chỉ xoá sự kiện có id do chính nó tạo ra).
- Access token chỉ dùng trong lúc đồng bộ, **không được lưu lại**.
- Lịch học **không được lưu cache**.
- Thu hồi quyền bất cứ lúc nào tại <https://myaccount.google.com/permissions>.
- Xem thêm [SECURITY.md](SECURITY.md) về mô hình bảo mật và chính sách báo cáo lỗ hổng.

---

## Hạn chế đã biết

- Chỉ đọc **tuần đang hiển thị** trên trang.
- Chỉ có **11 màu** của Google Calendar cho sự kiện.
- Nếu TDTU đổi giao diện / cấu trúc trang, việc đọc lịch có thể cần cập nhật.
- Chưa có tuỳ chọn nhắc lịch (reminder) riêng, dùng nhắc mặc định của lịch.

## Giấy phép

[MIT](LICENSE). Dựa trên [MinhQuan06/TDTU-extensions](https://github.com/MinhQuan06/TDTU-extensions).
Dự án không liên kết hay được TDTU hoặc Google bảo trợ.
