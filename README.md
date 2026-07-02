<div align="center">

<img src="icons/icon.svg" width="84" alt="OpenBooth" />

# OpenBooth

**開源・離線優先・可自訂的同人 / 手作擺攤收銀台**
*Open-source, offline-first, customizable POS for doujin & craft-market sellers*

[**繁體中文**](README.md) · [English](README.en.md) · [日本語](README.ja.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-c46b43.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/▶-Live%20demo-c46b43)](https://mimito-6.github.io/openbooth/)
[![ci](https://github.com/mimito-6/openbooth/actions/workflows/ci.yml/badge.svg)](https://github.com/mimito-6/openbooth/actions/workflows/ci.yml)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-4a8b5c.svg)](CONTRIBUTING.md)

[**▶ 線上 Demo**](https://mimito-6.github.io/openbooth/) · [快速開始](#-快速開始) · [功能](#-功能) · [設計理念](DESIGN.md) · [貢獻](CONTRIBUTING.md)

</div>

---

> 一支手機，搞定擺攤大小事。點商品 → 結帳，兩步成交。
> 你的營業資料**永遠不會離開這支手機** — 無帳號、無雲端、可離線、原始碼公開可自審。

OpenBooth 是給 CWT / FF / Comiket / 各種市集擺攤賣家用的收銀台。它把一個寫死自家商品的小工具，重寫成**任何人都能用設定畫面自訂**的開源系統 —— 不用寫程式，不用註冊，會場沒網路也能用。

## ✨ 為什麼選它

| | OpenBooth | 通用雲端 POS (Square…) | 紙 + 計算機 |
|---|:---:|:---:|:---:|
| 會場沒網路也能用 | ✅ 離線優先 | ⚠️ 連線才順 | ✅ |
| 自動算找零 | ✅ | ✅ | ❌ 易錯 |
| 套組 / 批量優惠 / 特典 / 滿額禮 | ✅ | ❌ | ❌ |
| 多場次分開記帳 (Day1/Day2) | ✅ | ❌ | 😵 |
| 預購名單 CSV 匯入核銷 | ✅ | ❌ | 😵 |
| 收據列印 / 分享 (選用) | ✅ 免費 | ⚠️ 需硬體 / 月費 | ❌ |
| 不留金流足跡 (二創 / 18禁友善) | ✅ 純本地 | ❌ 上雲 | ✅ |
| 月費 / 抽成 | 免費開源 | 💸 | 免費 |

## 🧩 功能

對應主畫面的 7 大功能格子：

- **🛒 開賣前台 (FRONT)** — 商品分類頁籤、快速點選、購物車即時加總
- **🧾 結帳 (CHECKOUT)** — 自訂付款方式、**現金找零計算**、滿額禮提醒、**特典標記**、臨時改價 / 湊整
- **📦 庫存管理 (STOCK)** — 商品 / 分類 / 套組 CRUD、商品圖片、批量優惠規則、即時庫存遞減
- **📅 活動設定 (EVENT)** — 多場次切換 (CWT Day1 / Day2…)、攤位編號，各場銷售分開結算
- **📋 預購登錄 (PICKUP)** — 名單管理、**CSV 匯入**、待取 / 已通知 / 已取貨、一鍵複製通知文案
- **💳 收款設定 (PAY)** — 自訂付款方式 (現金 / Line Pay / PayPay / 街口…) + 收款 QR 圖
- **📊 販售紀錄 (RECORD)** — 交易明細、撤銷退貨、商品排行、**收攤對帳 (起始備用金 → 現金應有 vs 實點)**、CSV 匯出

加上：資料 JSON 備份 / 還原、**設定包一鍵分享**、對客顯示、繁中 / 日文 / English / 한국어、**18 種可切換主題**（從溫暖手作到金屬未來、點陣像素風）、PWA 可安裝離線。

## 🧾 收據列印 / 分享（選用）

結帳完成後，可把收據**列印、分享、或下載成圖片**。三種輸出門檻不同：

| 方式 | 需要什麼 | 誰能用 |
|---|---|---|
| **下載圖片** | 無 | 所有人（手機 / 電腦） |
| **分享** | 無 | 多數手機（叫出系統分享面板，傳 LINE / 存相簿） |
| **藍牙列印** | 一台藍牙熱感收據機 + 支援 Web Bluetooth 的瀏覽器（Chrome / Edge） | ⚠️ iPhone / Safari 不支援，但下載 / 分享照常可用 |

- **版型可自訂**：到「設定 → 🧾 收據 → 匯入版型設定檔」上傳一份 JSON，收據就長你設計的樣子；**不上傳也有預設版型**。設定存在本機，不碰雲端。
- **隱私說明**：彩色版型第一次算圖時會向 `fonts.googleapis.com` 抓字型；離線或抓取失敗會自動退回系統字。熱感列印（黑白）與 App 其餘部分完全離線。
- 收據引擎為**選用外掛**，原始碼開源於 **[receipt-engine](https://github.com/mimito-6/receipt-engine)**；內含的第三方元件（皆 MIT）見 [RECEIPT-THIRD-PARTY.md](RECEIPT-THIRD-PARTY.md)。

## 🚀 快速開始

**A. 直接用線上版**（最簡單）
開啟 [Demo 連結](https://mimito-6.github.io/openbooth/)，點右上 ⚙ → 「載入示範商品」即可試玩。手機按「加到主畫面」就能離線當 App 用。

**B. 下載離線單機版**
下載整個專案，直接用瀏覽器開啟 `index.html` 即可（無需安裝、無需伺服器）。

**C. 開發 / 自架**
```bash
git clone https://github.com/mimito-6/openbooth.git
cd openbooth
# 零建置：任何靜態伺服器即可
npx serve .        # 或 python -m http.server
# 開啟 http://localhost:3000
```
部署：把整個資料夾丟到 GitHub Pages / Netlify / 任何靜態空間即可。

## 🔗 一鍵分享你的攤位

在「設定 → 產生分享連結」會把你的商品 / 分類 / 套組 / 主題打包成一條網址（**不含交易與顧客資料**）。把連結貼到 Plurk / Twitter，別人點開 60 秒就能複製整攤再微調。

## 🔒 資料與隱私

- 所有資料只存在你瀏覽器的 `localStorage`（圖片在裝置端），**不會上傳任何伺服器**。
- 預購名單含顧客個資，僅存本機；匯出檔請自行妥善保管。
- ⚠️ **收攤前請到「設定 → 匯出全部資料」備份一次** —— 清快取 / 換手機會清空 localStorage。

## 🛠 技術

原生 JavaScript（零框架、零建置、單一 `index.html` + 模組化 `js/`），`localStorage` 儲存，PWA 離線。刻意保持「fork 即改、開檔即用」的低門檻。詳見 [DESIGN.md](DESIGN.md)。

## 📄 授權

程式碼 [MIT](LICENSE)。社群投稿的設定包 / 美術建議以 CC0 / CC BY 標示。
範例為原創 / 泛用品項；請勿在公開設定包中散布第三方 IP（二創）素材。歡迎 PR、翻譯與設定包投稿，見 [CONTRIBUTING.md](CONTRIBUTING.md)。
