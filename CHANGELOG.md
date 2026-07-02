# Changelog

All notable changes to OpenBooth are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.3.0] — 2026-07

A big design round: an inline-SVG icon system (no more emoji), a jump from
5 to **18 switchable themes**, and a self-hosted pixel font with full
Traditional-Chinese coverage.

### Added
- **18 themes**, up from 5. Beyond the original warm/handmade set:
  - **Prototype design themes**: koishi (warm plaster / pebble claymorphism),
    linen, graphite, sage, sabi (錆 wabi-sabi).
  - **Metallic / futuristic**: titanium, gunmetal, chrome.
  - **Reference-driven bold layouts (v2 round)**: folio, halftone, zine, spec,
    pixel (THE SIGNAL black/yellow HUD).
  - **Character themes**: meido (メイド café), nothing (Nothing-OS dot-matrix
    minimal).
- **Inline-SVG icon system** — a single set of crisp line icons rendered from
  code, so icons stay sharp at any size and match each theme's ink colour.
- **Cubic 11 (俐方體11號) pixel font** — an open-source (SIL OFL 1.1) Traditional
  Chinese bitmap font covering Big5 level-1 (5401 glyphs) + 常用國字 + kana in a
  single 400 KB woff2. The pixel-style themes now render full TC pixel glyphs
  instead of falling back to the system font per character.

### Changed
- **All emoji removed app-wide**, replaced by the inline-SVG icons for a
  consistent, theme-aware look.
- Replaced the previous 123-chunk on-demand DotGothic16 setup (~1.1 MB across
  123 files) with the single Cubic 11 woff2. Service-worker cache bumped to
  `openbooth-v28`.

### Fixed
- Cart-detail sheet showing a black screen when reopened.
- Double-modal trap after checkout.
- Badge / quantity rows mis-rendering in the item grid.
- Nav icons not centred in their wells; logo shifting position across themes.

## [0.2.0] — 2026-06

Receipt printing / sharing, and booth numbers.

### Added
- **Receipt engine (optional add-on).** After a sale you can now print, share,
  or download a receipt image:
  - **Download image** and **Share** work everywhere (the share button opens the
    OS share sheet on phones; desktop falls back to download).
  - **Bluetooth thermal printing** to a 58/80mm receipt printer via Web Bluetooth
    (Chrome / Edge). iPhone / Safari don't support Web Bluetooth, so those fall
    back to download / share — the rest of the app is unaffected.
  - **Customizable layout**: import a template-config JSON in
    **Settings → 🧾 Receipt**; a default layout is used if none is imported.
  - Fully localized (繁中 / 日本語 / English / 한국어) and precached by the
    service worker so it works offline. The optional colour layout fetches web
    fonts from Google Fonts on first render and falls back to system fonts
    offline — see [RECEIPT-THIRD-PARTY.md](RECEIPT-THIRD-PARTY.md) for the
    bundled MIT components (qrcode-generator, Zod) and the font-fetch note.
- **Booth number** field on events, shown alongside the location in the event
  list. Localized in all four locales.

### Changed
- Receipt scripts now live under `js/` with the rest of the app code and are
  part of the service-worker precache (cache bumped to `openbooth-v17`).

## [0.1.4] — 2026-06

Settings & internationalisation polish.

### Changed
- **Language is now chosen in Settings**, not on the home screen. The Settings
  language field is marked with a 🌐 globe icon and the universal word
  "Language" (e.g. `🌐 語言 · Language`) so anyone can find it. First run still
  auto-detects the browser locale, so non-Chinese visitors land in their own
  language and the Settings tile is already translated. The home-screen
  language switcher (and its CSS) were removed.
- **Home**: removed the duplicate "Front desk" tile (the big "Open stall"
  button already opens it) and shortened that button's label.
- **Checkout**: simplified the cash pad to a single "Exact" button — the
  numeric keypad and typed amount already cover everything else.
- **Settings**: clearer data-backup button labels (which export includes
  sales/customer data vs. which is the shareable, sales-free preset); the
  post-sale toggle now reads "Show receipt".

### Fixed
- **Internationalisation**: localized 10 remaining hardcoded Traditional-Chinese
  strings that a non-Chinese user could hit (full-storage save error, shared-
  preset import dialog, invalid-link toast, mascot/logo label, preset-too-large
  toast, image-processing error, payment-QR alt text, and the event/contact/
  payment placeholder examples). All four locales stay aligned at 227 keys.
- Code of Conduct now uses private GitHub channels instead of a public email.

## [0.1.3] — 2026-06

Internationalisation, pre-order UX, and OSS-repo polish.

### Added
- **Korean (`ko`) UI locale** — full translation; home-screen language switch now shows native names: 繁體中文 / 日本語 / English / 한국어.
- **Korean Won (`KRW`, ₩)** added to the currency list.
- New built-in **ocean** theme (cool palette).
- **Helper-lock (PIN) mode** — lock the back-office, hide revenue & history, keep only the sell flow available; unlock with a 4-digit PIN. Survives reload.
- **Post-sale thank-you card** (Settings → "Show thank-you card after sale").
- **Per-product sales CSV** export on the RECORD screen.
- PICKUP: **reversible 3-segment status toggle** ([待取 ｜ 已通知 ｜ 已取貨]) — any state to any state, not just one-way.
- PICKUP: **customisable pre-order notification template** (Settings) with `{items}` / `{amount}` variables; edit screen shows a **live preview** that updates as you type, plus a one-tap "copy to clipboard" button.
- Zero-dependency **pricing tests** (`node tests/pricing.test.js`) — covers bundles, combos, freebies, manual override, discount, gift-threshold.
- Repo polish for OSS: **`AGENTS.md`**, GitHub Actions **CI** (JS syntax, pricing tests, 4-locale alignment, preset JSON validation), issue & PR templates, **`SECURITY.md`**, **`CODE_OF_CONDUCT.md`**, social preview image.

### Changed
- Home: native-name language switcher replaces the old single-locale label.
- Settings → About: dropped the hardcoded version string; tagline now goes through i18n (no manual edit per release).
- Demo stall rewritten with **neutral round prices (5 / 10 / 100)**; removed 緞帶吊飾; gift threshold lowered to NT$100 so it triggers with the new tiers.
- Cash pad: removed redundant "Exact" shortcut — typing the amount or "+denom" buttons handle the same case.

### Fixed
- Code of Conduct: removed public email address (private GitHub channels only) to avoid scraping.
- Stray empty files (`OB`, `HTTP`, etc.) cleaned out of the repo root.

## [0.1.2] — 2026-06

Multilingual polish.

### Added
- In-app **language switcher on the home screen** — buttons show each language's native name, so visitors who can't read the current UI can still find theirs.

### Changed
- Project renamed to **OpenBooth** with a clean flat market-stall icon.
- Home tiles no longer show grey English code labels under each icon.
- Removed the hardcoded Chinese changelog block from Home (it didn't follow the language switch).

## [0.1.0] — 2026-06

First open-source release. Rebuilt from a hardcoded single-file prototype into a
data-driven, customizable, offline-first POS.

### Added
- **Data-driven catalog** — products, categories and combos are fully editable in
  the UI (no code editing). Each entity has a stable UUID.
- **FRONT** — category tabs, quick-tap grid, live cart, product images & search.
- **CHECKOUT** — custom payment methods, cash change calculator with denomination
  quick-keys, gift-threshold (滿額禮) prompts, freebie (特典) line tagging, per-line
  price override and order rounding.
- **STOCK** — product / category / combo CRUD, image upload (auto-downscaled),
  multi-tier bundle pricing rules, derived live stock.
- **EVENT** — multiple sessions (CWT Day1/Day2…), per-event sales records, starting
  cash float.
- **PICKUP** — pre-order list, CSV import/export, pending/notified/picked status,
  copy-notice template.
- **PAY** — custom payment methods with optional payment QR image.
- **RECORD** — transactions, undo/void (restores stock), product ranking, **cash-up
  reconciliation** (float → expected vs counted), CSV export.
- **SETTINGS** — shop name, currency (TWD/JPY/USD/…), language, theme, mascot,
  full JSON backup/restore, shareable stall preset + `?config=` share link, demo data.
- Offline PWA (installable, cache-first service worker), i18n (繁中 / 日本語 /
  English), 4 themes, customer-facing display.

### Fixed (vs prototype)
- Transactions now store **price snapshots** + expanded `stockUse`, so editing or
  deleting products never corrupts historical records.
- All user-entered text is escaped on output (XSS-safe).
- Inventory is derived per the new multi-event model.

### Removed
- All third-party IP sample data from the original prototype; replaced with
  original/generic demo items.
