<div align="center">

<img src="icons/icon.svg" width="84" alt="OpenBooth" />

# OpenBooth

**オープンソース・オフライン優先・カスタマイズ自在の同人／ハンドメイド即売レジ**
*Open-source, offline-first, customizable POS for doujin & craft-market sellers*

[繁體中文](README.md) · [English](README.en.md) · [**日本語**](README.ja.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-c46b43.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/▶-Live%20demo-c46b43)](https://mimito-6.github.io/openbooth/)
[![ci](https://github.com/mimito-6/openbooth/actions/workflows/ci.yml/badge.svg)](https://github.com/mimito-6/openbooth/actions/workflows/ci.yml)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-4a8b5c.svg)](CONTRIBUTING.md)

[**▶ オンラインデモ**](https://mimito-6.github.io/openbooth/) · [はじめに](#-はじめに) · [機能](#-機能) · [設計](DESIGN.md) · [貢献](CONTRIBUTING.md)

</div>

---

> スマホ一台でブース運営。商品をタップ → 会計、2 ステップで完了。
> あなたの売上データは**スマホの外に出ません** — アカウント不要・クラウド不要・オフライン動作・ソースは自分で確認可能。

OpenBooth は同人即売会やハンドメイドマーケット（コミケ、CWT、FF、各種マルシェ…）の出店者向けレジです。出品物がハードコードされた小さなツールを、**誰でも設定画面からカスタマイズできる**オープンなシステムに作り直しました。コーディング不要、登録不要、会場の電波がなくても動きます。

## ✨ 選ばれる理由

| | OpenBooth | 汎用クラウド POS (Square…) | 紙 + 電卓 |
|---|:---:|:---:|:---:|
| 会場の電波がなくても動く | ✅ オフライン優先 | ⚠️ 接続が必要 | ✅ |
| おつり自動計算 | ✅ | ✅ | ❌ ミスしやすい |
| セット/まとめ割/特典/プレゼント | ✅ | ❌ | ❌ |
| イベント別の帳簿 (Day1/Day2) | ✅ | ❌ | 😵 |
| 予約リスト CSV 取込・消込 | ✅ | ❌ | 😵 |
| レシート印刷／共有（任意） | ✅ 無料 | ⚠️ 機材 / 月額 | ❌ |
| 決済の足跡を残さない (二次創作/成人向けにやさしい) | ✅ ローカルのみ | ❌ アップロード | ✅ |
| 月額 / 手数料 | 無料・OSS | 💸 | 無料 |

## 🧩 機能

ホーム画面の 7 つのタイルに対応：

- **🛒 販売フロント (FRONT)** — カテゴリタブ、ワンタップ選択、カート即時合計
- **🧾 会計 (CHECKOUT)** — 支払い方法カスタム、**現金おつり計算**、プレゼント（満額）案内、**特典タグ付け**、その場の価格変更／端数調整
- **📦 在庫管理 (STOCK)** — 商品／カテゴリ／セットの追加編集削除、商品画像、まとめ割ルール、在庫の自動連動
- **📅 イベント設定 (EVENT)** — 複数イベント切替（CWT Day1 / Day2…）、スペース番号、イベントごとに帳簿を分離
- **📋 予約登録 (PICKUP)** — リスト管理、**CSV 取込**、未受取／連絡済／受取済、連絡文ワンタップコピー
- **💳 支払い設定 (PAY)** — 支払い方法のカスタム（現金 / PayPay / Line Pay / …）＋支払い QR 画像
- **📊 販売記録 (RECORD)** — 取引明細、取消／返品、売れ筋ランキング、**精算（釣り銭準備金 → あるべき現金 vs 実際）**、CSV 出力

さらに：全データ JSON バックアップ／復元、**設定をリンク1本で共有**、客側表示、繁中 / 日本語 / English / 한국어、**18 種類の切替テーマ**（温かみのある手作り系から金属フューチャー、ドットマトリクスのピクセル風まで）、インストール可能なオフライン PWA。

## 🧾 レシート印刷／共有（任意）

会計後にレシートを**印刷・共有・画像で保存**できます。3 つの出力で必要なものが異なります：

| 出力 | 必要なもの | 使える人 |
|---|---|---|
| **画像を保存** | なし | 全員（スマホ / PC） |
| **共有** | なし | 多くのスマホ（OS の共有シート → LINE、写真に保存） |
| **Bluetooth 印刷** | Bluetooth サーマルレシートプリンター + Web Bluetooth 対応ブラウザ（Chrome / Edge） | ⚠️ iPhone / Safari は非対応。ただし保存／共有は使えます |

- **テンプレートを自由に**：**設定 → 🧾 レシート → テンプレを読込**で JSON をアップロードすると、デザインした見た目になります。**読み込まなくても既定のテンプレあり**。設定はローカル保存で、クラウドには送りません。
- **プライバシー**：カラーのテンプレは初回描画時に `fonts.googleapis.com` からフォントを取得します。オフラインや失敗時はシステムフォントに自動フォールバック。サーマル印刷（白黒）とアプリの他の部分は完全オフラインです。
- レシートエンジンは**任意のアドオン**で、ソースは **[receipt-engine](https://github.com/mimito-6/receipt-engine)** で公開しています。同梱の第三者コンポーネント（すべて MIT）は [RECEIPT-THIRD-PARTY.md](RECEIPT-THIRD-PARTY.md) を参照。

## 🚀 はじめに

**A. ホスト版をそのまま使う**（一番かんたん）
[デモ](https://mimito-6.github.io/openbooth/)を開き、右上の ⚙ →「サンプルを読込」でお試し。スマホで「ホーム画面に追加」すれば、アプリのようにオフラインで使えます。

**B. オフライン単体版をダウンロード**
プロジェクトをダウンロードし、ブラウザで `index.html` を開くだけ（インストール・サーバー不要）。

**C. 開発 / 自分でホスティング**
```bash
git clone https://github.com/mimito-6/openbooth.git
cd openbooth
# ビルド不要 — 任意の静的サーバーでOK
npx serve .        # または: python -m http.server
# http://localhost:3000 を開く
```
デプロイはフォルダごと GitHub Pages / Netlify / 任意の静的ホストに置くだけ。

## 🔗 ブースをリンク1本で共有

**設定 → 共有リンク生成**で、商品／カテゴリ／セット／テーマを 1 本の URL にまとめます（**取引・顧客データは含みません**）。X（Twitter）やPlurkに貼れば、相手は 60 秒でブース一式をコピーして微調整できます。

## 🔒 データとプライバシー

- すべてのデータはブラウザの `localStorage`（画像は端末内）に保存され、**どのサーバーにもアップロードされません**。
- 予約リストは顧客の個人情報を含み、ローカルのみに保存されます。書き出したファイルは適切に管理してください。
- ⚠️ **撤収前に「設定 → 全データ書出」で必ず一度バックアップを** — キャッシュ削除や機種変更で `localStorage` は消えます。

## 🛠 技術

素の JavaScript（フレームワーク無し・ビルド無し・単一の `index.html` + モジュール化した `js/`）、`localStorage` 保存、オフライン PWA。「fork してすぐ編集、開いてすぐ動く」敷居の低さを意図的に維持しています。詳細は [DESIGN.md](DESIGN.md)。

## 📄 ライセンス

コードは [MIT](LICENSE)。コミュニティ投稿の設定／アートワークは CC0 / CC BY での表示を推奨します。
サンプルはオリジナル／汎用の品目です。公開設定に第三者 IP（二次創作）素材を含めないでください。PR・翻訳・設定投稿を歓迎します — [CONTRIBUTING.md](CONTRIBUTING.md) をご覧ください。
