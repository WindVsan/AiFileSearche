<div align="center">

![demo](/assets/icon.png)

# 🔍 AI File Searcher

### 「ファイル名を忘れても見つかる」AI検索ツール

![demo](/assets/1.png)

> 「あのファイルどこだっけ？」をAIで一瞬解決

[![Node.js](https://img.shields.io/badge/Node.js-16+-43853D?style=for-the-badge\&logo=node.js\&logoColor=white)](https://nodejs.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-3.1_Flash-8E75B2?style=for-the-badge\&logo=googlebard\&logoColor=white)](https://aistudio.google.com/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge\&logo=windows\&logoColor=white)](#)

</div>

---

## 🤯 何がすごいの？

普通の検索：

> ファイル名を覚えてないと詰み

AI File Searcher：

> 「昨日作った資料」「マイクラの配布ワールド」でOK

👉 名前を忘れても“意味”で見つかる

---

## ⚡ 特徴（重要なとこだけ）

* 🧠 **AI曖昧検索**
  思考そのままの言葉でOK（例：「昨日のやつ」）

* ⚡ **超高速スキャン**
  数百ファイルでも数秒で特定

* ⭐ **関連度ランキング**
  上位3件をハイライト＋★評価

* 📂 **拡張子フィルター**
  .txt / .zip / .ymmp / .psd など幅広く対応

* 🎯 **AI学習機能**
  よく開くファイルを自動で優先表示

---

## 🧪 実際に使うとこうなる

### 🔍 「今月作ったやつ」

→ 約600ファイルから
→ AIが候補を10件に絞る
→ 数秒で発見

---

### 🔍 「マイクラの配布ワールド」

→ zipファイルを判別
→ 関係あるものだけ表示
→ ほぼ正解

👉 ファイル名を覚えてなくても見つかる

---

## 🖥 UI

![ui](/assets/2.png)

* 上位3件を金・銀・銅でハイライト
* 検索時間をリアルタイム表示
* 検索中のフォルダを可視化
* ワンクリックで検索中止可能

---

## 🚀 使い方（30秒）

### 🖥 対応環境

* Windows（推奨）
* Node.js 16以上

※ 現在はWindows向けに最適化されています
※ Mac版も開発検討中です（需要があれば優先します）

---

### 1. Node.jsをインストール

https://nodejs.org/

---

### 2. APIキーを設定

[Google AI Studio](https://aistudio.google.com/)で取得して
`apis.json` に貼り付け

```json
{
  "apiKey": "YOUR_API_KEY",
  "models": ["gemini-3.1-flash-lite-preview"]
}
```

---

### 3. 起動

run.bat をダブルクリック

👉 初回は自動で `npm install` 実行されます

---

## 🔥 主な機能

* インテリジェント検索（曖昧OK）
* 相対時間検索（「昨日」「今月」）
* 内容検索（txt / md など）
* 拡張子マルチフィルター
* リアルタイム進捗表示
* 検索キャンセル機能
* AI学習による順位最適化

---

## 🧩 こんな人におすすめ

* ファイル名を覚えてない人
* デスクトップがカオスな人
* Explorer検索にイライラしてる人
* クリエイター（動画・画像・コード）

👉 一度使うと戻れません

---

## 📖 ドキュメント

* 使い方ガイド → `使いかた.html`
* 技術仕様 → `Technology.md`

---

## ⭐ サポート

このプロジェクトが役に立ったら
**Starしてもらえるとめちゃくちゃ嬉しいです！**

Mac版の需要があれば優先して対応したいので、
よかったらStarやコメントで教えてください！

---

## 🛠 Tech

* Node.js
* Gemini API (3.1 Flash Lite)
* HTML / CSS / JavaScript

---

<div align="center">

**Created with ❤️ by WindVsan**

</div>
