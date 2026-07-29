<div align="center">

<img src="icons/icon.svg" width="84" alt="OpenBooth" />

# OpenBooth

**Open-source, offline-first, customizable POS for doujin & craft-market sellers**

[繁體中文](README.md) · [**English**](README.en.md) · [日本語](README.ja.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-c46b43.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/▶-Live%20demo-c46b43)](https://mimito-6.github.io/openbooth/)
[![ci](https://github.com/mimito-6/openbooth/actions/workflows/ci.yml/badge.svg)](https://github.com/mimito-6/openbooth/actions/workflows/ci.yml)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-4a8b5c.svg)](CONTRIBUTING.md)

[**▶ Live Demo**](https://mimito-6.github.io/openbooth/) · [Quick start](#-quick-start) · [Features](#-features) · [Design](DESIGN.md) · [Contributing](CONTRIBUTING.md)

</div>

---

> One phone runs your whole booth. Tap items → check out, done in two steps.
> Your sales data **never leaves your phone** — no account, no cloud, fully offline, source you can audit.

OpenBooth is a point-of-sale for sellers at doujin / fan conventions and craft markets (CWT, FF, Comiket, flea markets…). It takes a tiny tool that had one seller's goods hardcoded and rebuilds it into an open system **anyone can customize from the UI** — no coding, no sign-up, works with no venue Wi-Fi.

## ✨ Why OpenBooth

| | OpenBooth | Generic cloud POS (Square…) | Paper + calculator |
|---|:---:|:---:|:---:|
| Works with no venue network | ✅ offline-first | ⚠️ needs connection | ✅ |
| Automatic change calculation | ✅ | ✅ | ❌ error-prone |
| Bundles / batch deals / freebies (特典) / spend-gifts | ✅ | ❌ | ❌ |
| Per-session books (Day1/Day2) | ✅ | ❌ | 😵 |
| Pre-order list CSV import & check-off | ✅ | ❌ | 😵 |
| Receipt print / share (optional) | ✅ free | ⚠️ hardware / fee | ❌ |
| No payment footprint (fan-work / 18+ friendly) | ✅ local-only | ❌ uploads | ✅ |
| Monthly fee / commission | free & open | 💸 | free |

## 🧩 Features

The seven tiles on the home screen:

- **🛒 Front Desk (FRONT)** — category tabs, quick-tap grid, live cart total
- **🧾 Checkout** — custom payment methods, **cash change calculator**, spend-gift prompts, **freebie (特典) tagging**, on-the-fly price override / rounding
- **📦 Inventory (STOCK)** — product / category / combo CRUD, product images, bundle-pricing rules, live derived stock
- **📅 Events (EVENT)** — switch between sessions (CWT Day1 / Day2…), booth number, separate books per session
- **📋 Pre-orders (PICKUP)** — list management, **CSV import**, pending / notified / picked-up, one-tap notice copy
- **💳 Payment (PAY)** — custom methods (cash / Line Pay / PayPay / …) + payment QR image
- **📊 Records (RECORD)** — transactions, void/refund, product ranking, **cash-up reconciliation (starting float → expected vs counted)**, CSV export

Plus: full JSON backup / restore, **one-link stall preset sharing**, customer-facing display, 繁中 / 日本語 / English / 한국어, **16 switchable themes** (warm handmade, Swiss silver, doujin-zine photocopy, dot-matrix pixel, maid café), installable offline PWA.

## 🧾 Receipt print / share (optional)

After a sale you can **print, share, or download** a receipt. The three outputs have different requirements:

| Output | Needs | Who can use it |
|---|---|---|
| **Download image** | nothing | everyone (phone / desktop) |
| **Share** | nothing | most phones (opens the native share sheet → LINE, save to Photos) |
| **Bluetooth print** | a Bluetooth thermal receipt printer + a Web-Bluetooth browser (Chrome / Edge) | ⚠️ not iPhone / Safari — but download / share still work |

- **Customizable layout**: in **Settings → 🧾 Receipt → Import template config**, upload a JSON and the receipt looks the way you designed it; **there's a default layout if you don't**. The config is stored locally, never in the cloud.
- **Privacy note**: the colour layout fetches web fonts from `fonts.googleapis.com` on its first render; offline or on failure it falls back to system fonts. Thermal printing (B&W) and the rest of the app stay fully offline.
- The receipt engine is an **optional add-on**, open-source at **[receipt-engine](https://github.com/mimito-6/receipt-engine)**; its bundled third-party components (all MIT) are listed in [RECEIPT-THIRD-PARTY.md](RECEIPT-THIRD-PARTY.md).

## 🚀 Quick start

**A. Use the hosted version** (easiest)
Open the [demo](https://mimito-6.github.io/openbooth/), tap ⚙ (top-right) → "Load demo products" to try it. On a phone, "Add to Home Screen" to use it offline like an app.

**B. Download the offline single build**
Download the project and open `index.html` in any browser — no install, no server.

**C. Develop / self-host**
```bash
git clone https://github.com/mimito-6/openbooth.git
cd openbooth
# Zero build step — any static server works
npx serve .        # or: python -m http.server
# open http://localhost:3000
```
Deploy by dropping the folder on GitHub Pages / Netlify / any static host.

## 🔗 Share your stall in one link

In **Settings → Create share link**, your products / categories / combos / theme are packed into a single URL (**no transactions or customer data**). Paste it on Twitter / Plurk and anyone can copy your whole stall in 60 seconds and tweak it.

## 🔒 Data & privacy

- All data lives in your browser's `localStorage` (images on-device) and is **never uploaded to any server**.
- Pre-orders contain customer personal info and stay local only; handle exported files responsibly.
- ⚠️ **Before closing, run Settings → Export all data once** — clearing cache / switching phones wipes `localStorage`.

## 🛠 Tech

Vanilla JavaScript (no framework, no build step, a single `index.html` + modular `js/`), `localStorage` persistence, offline PWA. Deliberately keeps the "fork-and-edit, open-and-run" bar low. See [DESIGN.md](DESIGN.md).

## 📄 License

Code is [MIT](LICENSE). Community-contributed presets / artwork should be marked CC0 / CC BY.
Samples are original / generic items; please do not distribute third-party IP (fan-work) assets in public presets. PRs, translations and preset submissions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
