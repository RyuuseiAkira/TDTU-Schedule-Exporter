# Miku Helper interface

This browser extension reads a displayed TDTU timetable week, lets students review classes, and syncs or exports them. Use vanilla JavaScript, local assets and the strict extension CSP. English is the default; Vietnamese uses the same component tree and layout. Names and event identities remain independent of UI language.

## Direction

A single continuous dark working surface. The user rejected fragmented layouts, large decorative heroes and a contrasting pale action panel. Keep hierarchy in spacing and typography rather than nested cards. The selected week and real classes lead; the mascot is a small animated Miku companion in the header. Keep the existing layout and workflow; only the theme changes.

## Tokens

- Ground `#0d2228`; class/field surface `#142f35`; hover/selection `#20434a`; border `#31565e`.
- Foreground `#e8f8f4`; secondary text `#abc9cc`; primary action fill `#79dfd0`, ink `#103d40`.
- Accent: aqua `#71d9cf`, pink `#ef9cc8`, semantic success `#afd9cb`, error `#f2b2c2`.
- Segoe UI/system sans. Popup heading 21–22px, primary actions 13px, labels 12px, supporting copy 11px. Small day/date metadata is 10px. Monospace only for file extensions.
- Popup width 320px, 18px horizontal gutter, 8–12px between related controls, 17–21px between groups. Buttons have 9px corners; class rows join into a list.

## Components and behavior

- Header: Miku head, product name, settings icon. No duplicate product slogan or arbitrary status badge.
- Workflow: contextual instruction before fetch; selected date range and quiet refresh control once loaded.
- Week strip: actual seven dates of the fetched week, with active-day dots derived only from visible classes. Each date is a native button with an accessible label, pressed state, and session-count dots. Selecting it opens that day’s classes. All week restores the complete view. Left/Right/Home/End navigate dates; Enter/Space selects. View selection never filters exports or sync.
- Class review: collapsed after fetch, collapsible, with a bounded scroll area. Subject color is a small dot, not a thick colored border. Overlap and filter messages remain visible with the review.
- Save: one full-width Calendar action, actionable Client ID help below it when disconnected, and one secondary Download schedule button. Its native modal offers ICS and CSV with a clear all-week scope description. Escape, Cancel and backdrop clicks dismiss it; keyboard focus stays within the chooser and returns to Download on close. Never nest destination cards.
- Settings: four sections (Appearance, Subject colors, Filters, Google Calendar) in a quiet desktop navigation rail, single content column separated by rules. The current section has a mint edge, highlighted background and aria-current location state, updated on anchor clicks and scrolling. On narrow screens navigation wraps into rows.
- Mascot: head-only inline SVG; periodic blink and one brief greeting. Gentle pink/aqua falling music notes form the background. Appearance preference and OS reduced motion disable mascot and background animations.

## Validation

UI smoke checks use the same four-class fixture, viewport, connection state and pointer location for EN/VI previews. Verify settings/language persistence, masking, no horizontal overflow at 390px, blink and motion preferences, active week-strip days, safe event identity, and both browser packages. Direct extension loading remains restricted by managed Chromium; browser UI tests use a mock of extension APIs.

## User reference adaptation

Popup visuals follow the user-uploaded Miku helper: bold shadowed title, pink version capsule, dotted teal panel, dashed secondary action, raised aqua primary, and reference mascot beside a pale speech bubble. Uploaded helper application scripts and PDF utilities remain outside this repository; only the visual design and mascot artwork are adapted.

## Design-state regression checks

Run `node tests/design-browser.cjs` with Playwright available (set `CHROMIUM_PATH` if needed). This checks both languages, long text, refresh loading/error/empty states, auto-expanded overlap and all-filtered warnings, keyboard focus after palette updates, duplicate/Client ID errors, save and clipboard failures, failed sync startup, responsive Settings, and reduced motion. Generated QA screenshots live outside the checkout by default. Required invariants: never offer stale exports after a failed refresh; never hide critical overlap warnings in a closed review; never claim a failed settings save succeeded.

## Interaction feedback

Secondary buttons depress on press; the class-review chevron rotates and its contents enter over 180ms. Result messages replay a 200ms feedback animation when content/state changes. Sync progress does not bounce or scroll for every event. Save notifications ease into place. Appearance animation opt-out and reduced-motion disable decorative animations, transitions, and smooth scrolling.

## Settings filters

Use local line SVG icons, labelled code/name fields and explicit Hide subject / Restore actions. Hiding never removes a color assignment. Absence filtering and hidden-subject rules share the Filters section. New rules choose exact code or name substring matching; untyped legacy rules preserve their previous matching behavior. Rule input rejects blank and duplicate entries. A subject hidden by a keyword links to Review filter rather than offering a misleading restore. Filters apply to popup, both export formats and Calendar sync.
