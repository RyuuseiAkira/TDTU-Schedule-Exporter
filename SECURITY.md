# Security Policy

## Supported Versions

Only the latest release on the `main` branch is supported with security updates.

| Version | Supported |
|---|---|
| 1.7.x | Yes |
| < 1.7.0 | No |

## Threat Model and Security Architecture

TDTU Schedule Exporter runs entirely in the user's browser and handles untrusted DOM content from the university portal as well as OAuth tokens for Google Calendar. The extension enforces the following security controls:

1. **Strict Content Security Policy (CSP)**
   - `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src https://www.googleapis.com; object-src 'none'; base-uri 'none'; form-action 'none'`
   - No remote scripts, no remote fonts, no `eval`, and no inline event handlers.

2. **Untrusted Page Data Sanitization**
   - Timetable scraping executes via `scripting.executeScript` only when the user clicks the fetch button on `https://stdportal.tdtu.edu.vn` or `https://lichhoc-lichthi.tdtu.edu.vn` (verified by exact hostname over HTTPS).
   - No persistent content scripts are injected into web pages.
   - All scraped fields are validated, stripped of control characters, and length-capped via `sanitizeClass` before rendering or exporting.
   - Popup and Options UI build DOM elements using `document.createElement` and `textContent` rather than `innerHTML` with dynamic data.

3. **Export Hardening**
   - **CSV / Excel**: Every cell is sanitized against formula injection (`csvCell` prefixes a single quote `'` whenever a value starts with `=`, `+`, `-`, `@`, tab, or carriage return).
   - **ICS**: Text values are escaped according to RFC 5545 and lines are folded at 75 UTF-8 bytes without splitting multi-byte characters.

4. **Background Service Worker / Event Page Isolation**
   - `runtime.onMessage` only accepts messages where `sender.id === runtime.id` and `sender.url` starts with the extension's own `popup.html` URL.
   - Event payloads are re-validated in `background.js` (`buildSafeBody` whitelists fields, verifies ISO datetime format, and checks `colorId` 1–11).

5. **OAuth 2.0 and Google Calendar Safety Bounds**
   - Uses `identity.launchWebAuthFlow` with a cryptographically random 128-bit `state` parameter, verifying the redirect prefix, state match, token type, and granted `https://www.googleapis.com/auth/calendar.events` scope.
   - Access tokens are held only in local memory for the duration of the sync operation and are never written to storage.
   - Automatic stale-event cleanup only deletes events whose ID matches `^tdtu[0-9a-f]{40}$` (deterministic SHA-1 IDs created by this extension) within a bounded date range (at most 62 days) and aborts if more than 60 events would be deleted in a single run. Events created by the user or imported from `.ics` files are never modified or deleted.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report vulnerabilities privately through [GitHub Private Vulnerability Reporting](https://github.com/RyuuseiAkira/TDTU-Schedule-Exporter/security/advisories/new) on this repository. Include steps to reproduce and the affected browser version.
