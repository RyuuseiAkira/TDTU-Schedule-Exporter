# 🎓 TDTU Schedule Exporter

**English** · [Tiếng Việt](README.md)

A Chrome / Edge extension that reads your **timetable** from the Ton Duc Thang University (TDTU) schedule page and lets you:

- 📆 export an **.ics** file (Google Calendar, Outlook, Apple Calendar…)
- 📊 export **Excel / CSV**
- 🎨 **sync straight to Google Calendar with a different color per subject**

> ⚠️ Personal project, **not affiliated with TDTU**. Based on [MinhQuan06/TDTU-extensions](https://github.com/MinhQuan06/TDTU-extensions).

## ✨ Features

| Feature | Description |
|---|---|
| Weekly import | Reads the timetable currently open and resolves the real date of each class |
| Color per subject | Colors are assigned by **subject code** and editable in Settings |
| Google Calendar sync | Creates / updates events through the API; re-running **never duplicates** |
| Blacklist | Hide subjects by code or name keyword (default hides `000000` – "Lịch học Tiếng Anh dự kiến") |
| Ignore "GV báo vắng" | Toggle in Settings; classes the lecturer reported absent are not exported / synced |
| No cache | Every popup session re-reads the current timetable from the TDTU page |

Event description format: `Nhóm 5 | Mã: 501042 | Programming Methodology`

---

## 📦 Install

1. Get the code: `git clone https://github.com/<your-username>/<repo>.git`, or **Code → Download ZIP** and unzip.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the folder containing `manifest.json`.

> 💡 After editing code or `config.js`, click ⟳ **Reload** on the extension card.

## 🚀 Usage

1. Sign in to [stdportal.tdtu.edu.vn](https://stdportal.tdtu.edu.vn) and open the **Timetable** page (weekly view).
2. Click the extension icon → **📅 Lấy lịch học** (Get schedule).
3. Pick an export:
   - **📆 Xuất .ics** → import into a calendar (⚠️ Google Calendar **ignores colors** in .ics files).
   - **📊 Xuất Excel**
   - **🎨 Đồng bộ Google Calendar (có màu)** → needs the one-time API setup below.

Only the **week currently displayed** is read. To export another week, switch weeks on the TDTU page and click **Lấy lịch học** again.

---

## ⚙️ Settings

Click **⚙️** in the popup (or right-click the extension icon → *Options*). Changes are **saved automatically**.

- **🎨 Màu theo môn học (colors)**: one row per subject code + color. Click a dot to pick a color, 🚫 to move it to the blacklist, 🗑 to delete.
  Unlisted subjects use the **default color**. The popup shows **➕ Thêm vào Settings** to auto-assign colors to new subjects.
- **📅 Lớp học**: toggle *Ignore "GV báo vắng" classes* (on by default).
- **🚫 Blacklist**: enter a **subject code** (digits only, exact match, e.g. `000000`) or a **keyword** in the subject name (e.g. `tiếng anh`, case-insensitive). ⚠️ Short keywords may hide other subjects by accident.
- **☁️ Google Calendar**: Client ID and Calendar ID (see below).
- **♻️ Reset to defaults**.

Google offers only **11 event colors**: Lavender, Sage, Grape, Flamingo, Banana, Tangerine, Peacock, Graphite, Blueberry, Basil, Tomato. Arbitrary hex colors are not possible.

Initial defaults live in `config.js` (you don't need to edit it if you use Settings).

---

## 🔑 Google Calendar API setup (one time, free, ~10 min)

### Why is this needed?

When you import an `.ics` file, Google Calendar **discards per-event colors**. The only way to get one color per subject is to create events via the **Google Calendar API** (the `colorId` field). The API needs an **OAuth Client ID that you create yourself**, so the extension can ask permission to add events to your calendar.

- No credit card needed; the Google Calendar API is free.
- The **Client ID is not a secret** (this extension uses no client secret), but you should still use your own rather than sharing one.
- The extension only requests the `calendar.events` scope (create / edit events). It cannot read your email, contacts, or anything else.

> ℹ️ Google Cloud Console's UI changes often; menu names may differ slightly (e.g. *OAuth consent screen* now lives under **Google Auth Platform**). Follow the intent of each step.

### Step 1 — Get the extension's Redirect URI

1. Load the extension (see Install).
2. Open ⚙️ **Settings** → **Google Calendar** → the **Redirect URI** field, which looks like:
   `https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/`
3. Click **Copy** (used in Step 5).

> ⚠️ The `abcdef…` part is the **extension ID**, which depends on the folder path used for *Load unpacked*. If you **move or rename the folder** or reinstall elsewhere, the ID changes and you must update the Redirect URI in Google Cloud (Step 5).

### Step 2 — Create a Google Cloud project

1. Go to <https://console.cloud.google.com> and sign in with the Google account that owns your calendar.
2. Click the project picker at the top → **New project** → name it (e.g. `TDTU Calendar`) → **Create**.
3. Make sure the new project is selected.

### Step 3 — Enable the Google Calendar API

1. Menu ☰ → **APIs & Services** → **Library**.
2. Search **Google Calendar API** → **Enable**.

### Step 4 — Configure the OAuth consent screen

1. Menu ☰ → **APIs & Services** → **OAuth consent screen** (or **Google Auth Platform**).
2. If prompted, click **Get started** and fill in:
   - **App name**: anything (e.g. `TDTU Schedule Exporter`)
   - **User support email** and **Developer contact email**: your email
3. **Audience / User type**: choose **External**.
4. Under **Test users** (Audience → Test users) → **Add users** → add **the exact Google account you'll sync with** → **Save**.
   - Leaving the app in **Testing** status is fine; **no verification** is needed since only you use it.
5. *(If there's a Data access / Scopes section)* add `https://www.googleapis.com/auth/calendar.events`. If you skip it, Google still shows this scope on the consent prompt.

### Step 5 — Create the OAuth Client ID

1. **APIs & Services** → **Credentials** (or **Google Auth Platform → Clients**) → **Create credentials / Create client** → **OAuth client ID**.
2. **Application type**: **Web application** (not "Chrome extension").
3. **Name**: anything.
4. **Authorized redirect URIs** → **Add URI** → paste the Redirect URI from Step 1 (character for character, including the trailing `/`).
5. **Create**. A dialog shows your **Client ID**, like `123456789-abcdefg.apps.googleusercontent.com` → copy it.
   *(Ignore the "Client secret"; the extension doesn't use it.)*

> New configurations can take a few minutes to take effect. If you get an error right away, wait 5 minutes and retry.

### Step 6 — Paste the Client ID into the extension

⚙️ **Settings** → **Google Calendar** → paste into **Google OAuth Client ID**. (Saved automatically.)

### Step 7 — (Recommended) Create a dedicated calendar

A dedicated calendar lets you wipe the whole semester in one action.

1. Open [calendar.google.com](https://calendar.google.com) on a computer.
2. Next to **Other calendars** click **＋** → **Create new calendar** → name it (e.g. `TDTU Schedule`) → **Create calendar**.
3. Hover the new calendar → **⋮** → **Settings and sharing** → scroll to **Integrate calendar** → copy the **Calendar ID** (like `abc123@group.calendar.google.com`).
4. Paste it into **Calendar ID** in the extension's Settings.

Leave `primary` to use your main calendar. The calendar must belong to the signed-in account (or be shared with edit access).

### Step 8 — First sync

1. Open the timetable page → click **Lấy lịch học** → **🎨 Đồng bộ Google Calendar (có màu)**.
2. A Google sign-in window opens → choose the account you added as a Test user.
3. Google warns **"Google hasn't verified this app"** (it's your own app) → **Advanced** → **Go to … (unsafe)** → **Continue / Allow**.
4. The popup closes when the sign-in window opens. This is normal. The sync runs in the background; the extension icon shows ✓ when done, and reopening the popup shows the result (`Tạo mới N, cập nhật M sự kiện` = N created, M updated).

Re-sync any time: existing events are **updated** (room, time, color…) instead of duplicated.

> ⚠️ If you previously imported an `.ics` into the same calendar, **delete those old events** (or use the new calendar from Step 7) to avoid duplicates.
> ⚠️ Classes you hide **after** syncing are **not removed** from Google Calendar automatically; delete them manually.

### 🛠️ Troubleshooting

| Error | Cause & fix |
|---|---|
| `Error 400: redirect_uri_mismatch` | The Redirect URI in Google Cloud differs from the one in Settings. Re-copy it exactly (including the trailing `/`). If you moved the extension folder, the ID changed. |
| `Error 403: access_denied` / "has not completed verification" | The signed-in account isn't in **Test users** (Step 4). |
| `HTTP 403 – Google Calendar API has not been used…` | Calendar API isn't **enabled** in the same project as the Client ID (Step 3). Wait a few minutes after enabling. |
| `HTTP 404 – Not Found` | Wrong **Calendar ID**, or the calendar isn't in this account. Try `primary`. |
| `HTTP 401` | Token expired / rejected; click sync again to sign in afresh. |
| `Chưa nhập Google Client ID` | Client ID not set in Settings (Step 6). |
| `Không lấy được token đăng nhập Google` | You closed the sign-in window early, or the Client ID type isn't **Web application**. |
| Events have no color | Subject isn't in the color list, so the default (Graphite) applies. Add it in Settings. |
| Code `000000` / English class missing | It's in the default Blacklist; remove that row in Settings to export it. |

---

## 🔒 Privacy & security

- The extension runs **entirely in your browser**; there's no server of its own and no data is sent anywhere except the **Google Calendar API** (when you click sync).
- Permissions used:
  - `activeTab`, `scripting` + `stdportal.tdtu.edu.vn`, `lichhoc-lichthi.tdtu.edu.vn`: read the timetable you have open.
  - `storage`: keep Settings (colors, blacklist, Client ID, Calendar ID) in the browser's `chrome.storage.local`.
  - `identity` + `https://www.googleapis.com/*`: Google sign-in and Calendar API calls.
- OAuth scope: only `https://www.googleapis.com/auth/calendar.events`.
- The access token is used only during sync and is **not stored**.
- The timetable is **not cached**.
- Revoke access any time at <https://myaccount.google.com/permissions>.

> 🙋 **If you fork / contribute:** never commit `.ics` files, saved timetable pages (`.html`), or screenshots containing your schedule, name or student ID. `.gitignore` already blocks common extensions.

---

## 🗂️ Project structure

```
├── manifest.json     # Extension config (Manifest V3)
├── popup.html / popup.js    # Popup UI + timetable scraping + .ics/CSV export
├── options.html / options.js # Settings page
├── background.js     # Service worker: Google sign-in + Calendar API calls
├── shared.js         # Shared helpers: colors, event description, blacklist
├── config.js         # Default values (first install)
├── content.js        # Content script on TDTU pages
├── icons/            # 16 / 48 / 128 icons
└── LICENSE
```

## 🧩 Known limitations

- Reads only the **week currently displayed**.
- Only Google Calendar's **11 event colors**.
- If TDTU changes its page layout, the scraper may need updating.
- No custom reminders; the calendar's default reminders apply.

## 🤝 Contributing

Issues and Pull Requests are welcome. When reporting bugs, **redact personal information** in screenshots / attachments.

## 📄 License

[MIT](LICENSE). Based on [MinhQuan06/TDTU-extensions](https://github.com/MinhQuan06/TDTU-extensions).
Not affiliated with or endorsed by TDTU or Google.
